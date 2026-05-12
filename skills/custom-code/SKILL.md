---
name: custom-code
description: "Use when writing or reviewing any custom code in Bricks: echo tag, hooks, Code element (PHP/HTML/CSS/JS), theme style CSS, page/element custom CSS, Settings > Custom code, or Custom Query PHP. Covers capability gating, render order, security, silent-failure debugging, and which extension point to reach for."
---

**Requires:** Bricks 2.4+ with the Abilities API enabled

## Update check

Run first when filesystem tools are available:

```bash
_BS_UPDATE_CHECK=""
for _CAND in "$HOME/.bricks/skills/bricks-skills/scripts/bricks-skills-update-check" "$PWD/scripts/bricks-skills-update-check" "$HOME/.claude/skills/bricks-skills/scripts/bricks-skills-update-check" "$HOME/.codex/skills/bricks-skills/scripts/bricks-skills-update-check"; do
  [ -f "$_CAND" ] && _BS_UPDATE_CHECK="$_CAND" && break
done
[ -n "$_BS_UPDATE_CHECK" ] && sh "$_BS_UPDATE_CHECK" || true
```

If it prints `BRICKS_SKILLS_UPDATE_AVAILABLE <old> <new> <tag>`, load **bricks-skills-update** before continuing. If it prints `BRICKS_SKILLS_JUST_UPDATED <old> <new>`, mention the new version and continue.

# Bricks: custom code

Bricks has eight places code can live. Each has different capability gates, different security properties, and different silent-failure modes. Get the extension point wrong and the code either doesn't run, runs in the wrong context, or opens a remote-code-execution hole. Use it to choose the right extension point and apply the right rules.

## The eight extension points

| Point | What | Gated by | Runs |
|-------|------|----------|------|
| Echo tag `{echo:fn()}` | PHP function call inside dynamic data | Global code execution + allow-list; builder preview also checks Execute code cap | Per-tag render, server-side |
| Hooks | WP actions/filters in functions.php / plugin | None (it's just WP) | Globally, wherever the hook fires |
| Code element: PHP mode | PHP inside a Bricks Code element | Global code execution + valid signature; authoring/signing checks Execute code cap | Element render, server-side |
| Code element: raw mode | HTML/CSS/JS emitted verbatim at element position | None | Element render, output as-is |
| Theme style CSS | CSS tied to a theme style | None | Concatenated into page `<head>` |
| Page / element custom CSS | CSS scoped to a page or one element | None | Inline `<style>` in header |
| Settings > Custom code | Header/body/footer HTML/JS/CSS | Admin-only | Globally, on every page |
| Custom Query PHP | PHP inside the query-loop PHP editor | Global code execution + valid signature; authoring/signing checks Execute code cap | Query run, server-side |

## "Execute code" capability: what it gates

For builder authoring, the user role needs the `bricks_execute_code` capability to add or keep executable code paths such as Code element PHP mode, SVG source code, Custom Query PHP, and builder-preview echo execution. On the frontend, saved executable code is governed by global code execution, code signatures, and the echo allow-list, not the visitor's role.

- Set globally at `Bricks > Settings > Custom code > Code execution`.
- Per-role via the Bricks role manager.
- Canonical check inside your PHP: `Capabilities::current_user_can_execute_code()`: use this, not role-name comparison.
- **Never grant to Editor-tier roles on a site where staff isn't fully trusted**: it's direct RCE for them.

CSS and JS in Code element raw mode are not gated by the PHP execution toggle, but they still pass through Bricks' normal element-save security. Users without Execute code and without WordPress `unfiltered_html` have non-Code element settings KSES-filtered; executable Code, SVG code, Custom Query PHP, and modified echo tags are restored, stripped, or disabled during save (`includes/helpers.php:2744-2875`). Site-wide Settings > Custom code is admin settings UI, not normal post editing.

## Render order: why your override loses

Bricks builds several CSS buckets first, then concatenates them in a fixed order in `Assets::generate_inline_css()`. Use the actual concatenation order, not the setup-comment order (`includes/assets.php:832-909`). Later buckets win at equal specificity:

1. **Global variables**: `:root` variable CSS from the variable manager
2. **Theme styles**: concatenated theme-style CSS
3. **Utility classes**: style-manager utility classes when CSS loading is inline
4. **Global CSS classes**: site-wide class definitions
5. **Color vars**: palette custom properties, including dark-mode vars
6. **Page custom CSS**: page settings CSS
7. **Header**: header-template element CSS
8. **Content**: page/content-template element CSS
9. **Footer**: footer-template element CSS
10. **Popup**: active popup template CSS
11. **Template CSS**: template settings CSS
12. **Global custom CSS**: Settings > Custom code global CSS

(WP core + theme base CSS load before this whole block; inline `style=""` on elements and Code element raw output still win because they're *inside* the DOM at the element.)

Two implications:
- If your theme-style CSS isn't winning, something later won on specificity or used `!important`. Don't escalate with more `!important`: fix the source.
- Settings > Custom code global CSS is appended late, so it can override page and element CSS at equal specificity. Use it for true global overrides only; otherwise prefer theme styles, global classes, page CSS, or element CSS based on the scope of the change.

JavaScript: Settings > Custom code body/footer runs on every page, in document order. Code element raw JS runs where the element sits. Bricks doesn't defer your JS: wrap in `DOMContentLoaded` yourself.

## Echo tag: `{echo:function_name()}`

The broadest dynamic-data tag, and the most dangerous surface. Every Bricks security advisory since 1.9 has touched it.

### The allow-list filter

Echo is unavailable unless global code execution is enabled. Once enabled, each `{echo:...}` call still returns an empty string until the function passes `bricks/code/echo_function_names`:

```php
add_filter( 'bricks/code/echo_function_names', function() {
    return [
        '@^my_theme_',          // regex prefix (1.9.8+): whitelist your own helpers
        'wp_get_attachment_image',
        'get_the_date',
        'get_post_meta',
    ];
} );
```

Return shapes:
- **Array of literal names**: exact-match allow-list.
- **Array with `@` prefix entries**: regex (1.9.8+). `'@^brx_'` matches anything starting with `brx_`.
- **Boolean `true`**: allow-all. **Never in production**: that's the pre-1.9.7 RCE surface.

### Argument parsing (from `provider-wp.php:1260-1318`)

- Single quotes delimit strings. `{echo:foo('bar')}` passes `'bar'`.
- Commas separate args at the top level.
- No nested functions, objects, arrays, or double-quoted strings: write a wrapper function if you need them.
- Unquoted args pass as strings. `{echo:foo(42)}` passes `"42"`, not integer 42.

### Never allow-list

- **Callable-accepting functions**: `call_user_func`, `call_user_func_array`, `array_map`, `usort`, `preg_replace_callback`. Universal RCE pivots.
- **Command execution**: `shell_exec`, `exec`, `system`, `passthru`, `proc_open`, `popen`.
- **Code evaluators**: `eval`, `assert`, `create_function`, `preg_replace` with `/e` modifier.
- **Deserializers on attacker input**: `unserialize`, `maybe_unserialize`. JSON is usually fine.
- **Filesystem / network**: `file_get_contents`, `fopen`, `curl_exec`, `glob`, `scandir`, `readfile`, `file_put_contents`.

### Other echo rules

- **`bricks/code/echo_everywhere`** (undocumented filter): by default echo runs only in text-ish fields (heading, rich text). Setting this to `true` opens it to style values, URLs, etc. Expands the attack surface; only do it with a reason.
- **Builder-preview guard (1.12.2+)**: unauthorized users can't *add* new echo calls via the UI even when the function is allow-listed. Blocks staff-role privilege escalation.
- **Code Review tool**: `Bricks > Settings > Custom code`, button `Start: Code review`. It scans Code elements, SVG source code, Query editor snippets, and echo functions. Run it before shipping an echo allow-list. Academy: https://academy-preview.bricksbuilder.io/builder/features/code-review/

### Defensive wrapping

Instead of adding a raw WP function to the allow-list and hoping its args are always safe:

```php
function my_theme_post_title_by_id( $id ) {
    $id = absint( $id );
    if ( ! $id ) return '';
    return esc_html( get_the_title( $id ) );
}
```

Allow-list `my_theme_post_title_by_id`, not `get_the_title`. The wrapper validates and escapes.

## Hooks: the PHP extension point

Hooks don't need Bricks capability gating: they're WordPress actions/filters. Three things go wrong most often:

1. **Filters must return.** Callback forgets `return $value` and the filter value becomes `null`, breaking everything downstream.
2. **Priority contention.** Bricks fires many of its own hooks at priority 10. If you're overriding (not just observing), use priority 20+.
3. **Scope to the loop/element.** Most Bricks hooks pass a context object (`$query`, `$element`) with `element_id`. Branch on `element_id` inside the callback to avoid mutating every loop/element on the page.

See the `hooks-reference` skill for a curated hook index.

## Code element: the raw-output trap

Two modes:

- **Raw output** (default): HTML/CSS/JS emitted at the element position. No PHP execution gate, but save-time KSES/security checks still apply based on the current user's capabilities.
- **Execute Code** toggle: content treated as PHP. Gated by `bricks_execute_code`.

The trap: user pastes PHP into raw-output mode -> shows as text on the page. Fix is toggling Execute Code, *and* verifying the user's role has the capability: otherwise it renders empty silently.

**CSS/JS inside a Code element** is output inline in DOM order. For global JS/CSS, use Settings > Custom code or a proper enqueue, not a Code element.

## Custom Query (PHP) in query loops

Last-resort query-loop option when the UI can't express the query. Gated by `bricks_execute_code`. Expects a PHP array of query args for normal object queries. Non-array output is ignored after validation and may fall back to the remaining query vars or produce an empty loop depending on context.

**Prefer `bricks/posts/query_vars` hook.** Same effect, no per-user capability required, and the logic lives in version-controlled PHP instead of scattered across element settings (where audits can't find it).

## MCP: `_cssCustom` requires a selector wrapper

When setting element custom CSS via the MCP (`set-page-elements`, `add-element`, `update-element`), write a complete CSS rule with the persisted Bricks selector. The selector is part of the saved data.

### Which selector to use

| Context | Selector form | Example |
|---|---|---|
| Standalone page element | `#brxe-{id}` | `#brxe-wxb5dn { ... }` |
| Element inside a component | `.brxe-{id}` | `.brxe-wxb5dn { ... }` |
| Global class | `.{class-name}` | `.button { ... }` |

Standalone elements render with an `id="brxe-{id}"` attribute, so the ID selector is correct and more specific. Elements inside a component use the class selector because component instances may not have a unique ID in the same way.

The element ID (`wxb5dn`) comes from the internal 6-character `id` field in `get-page-elements` output, or from the response of `add-element` / `set-page-elements`. This same id powers the default frontend selector `#brxe-{id}`. Only set `settings._cssId` when a custom HTML id is explicitly needed.

### Format: use newlines, not single-line strings

```css
/* Correct */
#brxe-wxb5dn {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-lg);
}

/* Correct for a global class */
.button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
}

/* Wrong selector type for a standalone page element */
.brxe-wxb5dn { display: grid; }
```

In JSON strings, use `\n` for newlines and two-space indent: `"#brxe-wxb5dn {\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);\n  gap: var(--space-lg);\n}"`

## Silent-failure debug order

"My code doesn't run" or "output is empty." Check in order:

1. **Execution gate**: Settings > Custom code > Code execution toggled on. In the builder, also confirm the user's role has Execute code.
2. **Allow-list** (echo only): is the function in `bricks/code/echo_function_names`? Temporarily return `true` to confirm this is the cause, then revert.
3. **Mode toggle** (Code element only): Execute Code on/off correct for the content type.
4. **Hook plumbing**: filter callback is returning (not just mutating). Priority not being overwritten by something later.
5. **Runtime failure handling**: echo catches `Exception`, `ParseError`, and `Error`, then logs to `error_log()` (`provider-wp.php:1381-1394`). Code element PHP catches `Throwable` and either shows the error or suppresses output based on the element setting (`code.php:235-251`). Custom Query PHP echoes the caught error message during query building (`query.php:410-420`).
6. **CSS losing cascade**: DevTools -> Rules panel -> find the overriding selector. Usually element-level CSS trumping theme style, or specificity elsewhere.

## Decision tree: "I want to X"

| Want | Reach for |
|------|-----------|
| Show dynamic value in text | Dynamic data tag (prefer built-in tags over `{echo:}`) |
| Call a custom PHP function in text | Echo tag + allow-list entry |
| Site-wide analytics / pixels | Settings > Custom code (header/body/footer) |
| Per-page tracking snippet | Page settings -> custom code, or a Code element on that page |
| Global CSS tweak | Theme style CSS (not per-element) |
| One-off page CSS | Page custom CSS |
| Single element styling | Element custom CSS: last resort |
| Modify a loop's query args | `bricks/posts/query_vars` hook, not Custom Query PHP |
| Modify element render output | `bricks/element/render_*` hook |
| Inject HTML conditionally | Template element with conditions, not a Code element |
| Reusable PHP logic | Child theme / plugin with hooks, not scattered Code elements |

## Never trust builder input from low-privileged roles

Even inside Bricks, staff-tier users can modify element fields. If a filter or hook trusts a field value raw and passes it to `eval`, `include`, a callable, or shell-exec, that's RCE for staff. Treat any field that could originate from a non-admin editor as untrusted.

## Never do

- `return true` from `bricks/code/echo_function_names` in production. Ever.
- Allow-list callable-taking, filesystem, network, deserialize, or code-eval functions.
- Enable `bricks/code/echo_everywhere` "because a tag isn't rendering." Find the real reason first.
- Let `{echo:...}` arguments come from user input: URL params, form fields, REST payloads.
- Put PHP in a Code element when a hook would work: it's hiding from version control and audit tools.
- Stack `!important` in element CSS to win a cascade battle. Fix the actual specificity.
- Grant `bricks_execute_code` to Editor-tier roles on multi-tenant sites.

## Version history (echo tag)

- **Bricks <= 1.9.6**: echo tag allowed arbitrary function calls, no allow-list. Unauthenticated RCE (CVE). Patched in 1.9.7 by making the filter required.
- **1.9.8**: regex `@` prefix in allow-list entries.
- **1.12.2**: builder-preview guard against unauthorized users adding echo calls via UI.

Inherited a site on <= 1.9.6? Update Bricks first: the echo tag is a security liability regardless of whether the customer is "using it."
