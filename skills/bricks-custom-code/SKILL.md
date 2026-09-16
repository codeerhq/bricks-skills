---
name: bricks-custom-code
description: "Choose or debug a Bricks custom-code surface: CSS, JavaScript, Code elements, echo tags or PHP hooks, with the relevant execution capabilities."
---

# Bricks: custom code

Bricks has eight places code can live. Each has different capability gates, different security properties, and different silent-failure modes. Get the extension point wrong and the code either doesn't run, runs in the wrong context, or opens a remote-code-execution hole. Use it to choose the right extension point and apply the right rules.

## The eight extension points

| Point | What | Gated by | Runs |
|-------|------|----------|------|
| Echo tag `{echo:fn()}` | PHP function call inside dynamic data | Global code execution + allow-list; builder preview also checks Execute code cap | Per-tag render, server-side |
| Hooks | WP actions/filters in functions.php / plugin | None (it's just WP) | Globally, wherever the hook fires |
| Code element: PHP mode | PHP inside a Bricks Code element | Global code execution + valid signature; authoring/signing checks Execute code cap | Element render, server-side |
| Code element: snippet mode | Escaped HTML/CSS/JS shown as a code sample | Normal editing permissions | Element render, displayed in `<pre>` |
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

Code elements display escaped snippets when Execute code is absent. Their execution mode requires global code execution even for CSS/JS-only output (`includes/elements/code.php::render`). This is distinct from native style controls and `_cssCustom`, which do not require PHP opt-in. Save-time security also depends on the caller’s effective capabilities. Site-wide Settings > Custom code is an admin settings surface, not normal post editing.

## Code authoring through abilities

Bricks 2.4 distinguishes CSS, JavaScript, and PHP authoring in
`includes/abilities/code-authoring.php` and `elements.php`:

- CSS follows the target's editing permissions. JavaScript and unsafe raw HTML
  require WordPress `unfiltered_html`; a role name is not a capability check.
- Code elements keep their native execution-mode gate. A PHP/HTML field in execution
  mode still needs signing even when its current text contains only HTML. Dynamic
  code sources also stay on the PHP authorization path.
- Creating or changing signed PHP in Code elements or Query editors through abilities
  requires `BRICKS_ENABLE_PHP_ABILITIES === true`, Bricks abilities and global code
  execution enabled, unlocked signature generation, `manage_options`, the Bricks
  Execute code capability, and an authenticated WordPress Application Password
  request. The old prerelease `BRICKS_ENABLE_EXECUTE_PHP_ABILITY` name is not used.
- Authorized writers generate signatures. Do not fabricate or copy signatures, and
  do not reconstruct redacted source. Unchanged protected code can be preserved
  while editing permitted neighboring settings.
- `bricks/execute-php` uses the same PHP authorization contract. It executes supplied
  statements on the server without sandboxing; use it only for the user's requested
  work, including authorized PHP configuration or diagnostics. Do not use it to
  grant itself missing permissions or bypass a disabled ability.

For an import rejected by these checks, rewrite unsupported content or report the
missing prerequisite. The HTML/CSS page importer may retain a permitted partial
result; inspect `partial` and `omittedElements` as described in
[bricks-html-css-to-bricks](../bricks-html-css-to-bricks/SKILL.md).

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

Inline `style` attributes and later stylesheets still participate in the CSS cascade. A style rule emitted by an executing Code element does not automatically win merely because it sits inside the body.

Two implications:
- If your theme-style CSS isn't winning, something later won on specificity or used `!important`. Don't escalate with more `!important`: fix the source.
- Settings > Custom code global CSS is appended late, so it can override page and element CSS at equal specificity. Use it for true global overrides only; otherwise prefer theme styles, global classes, page CSS, or element CSS based on the scope of the change.

JavaScript: Settings > Custom code body/footer runs on every page, in document order. JavaScript from an executing Code element runs where its script is emitted. Initialize against the correct document-ready state; snippet mode only displays code.

## Echo tag: `{echo:function_name()}`

Echo calls a PHP function from content, so keep its allow-list limited to the functions needed by the site.

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

Wrap functions with explicit argument validation before adding them to the allow-list:

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

See the `bricks-hooks-reference` skill for a curated hook index.

## Code element: snippet versus execution mode

Two modes:

- **Snippet mode** (default): HTML, CSS, and JavaScript fields are escaped and displayed as code samples. They do not run.
- **Execute code**: PHP/HTML is verified and evaluated, CSS is emitted in a style element, and JavaScript in a script element. Global code execution must be enabled. Authoring requires Execute code; the PHP/HTML field additionally needs a valid signature.

If a snippet appears as text, first decide whether the user intended a code example
or running content. Do not enable execution just to hide the symptom. For running
content through abilities, follow the authorization rules above. For styling native
elements, prefer native controls or `_cssCustom` instead of an executing Code element.
For site-wide JavaScript, use the authorized global custom-code surface or an enqueue.

## Custom Query (PHP) in query loops

Last-resort query-loop option when the UI can't express the query. Gated by `bricks_execute_code`. Expects a PHP array of query args for normal object queries. Non-array output is ignored after validation and may fall back to the remaining query vars or produce an empty loop depending on context.

**Prefer `bricks/posts/query_vars` hook.** Keep shared query logic in version-controlled PHP using this hook.

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
2. **Allow-list** (echo only): check whether the exact intended function is permitted by `bricks/code/echo_function_names`. Do not enable every function as a diagnostic shortcut.
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
