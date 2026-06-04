---
name: bricks-headers-footers
description: "Use when authoring or editing Bricks header/footer templates: \"add a logo to the header\", \"make the footer sticky\", \"the header changes I made disappeared\". Covers the three-meta-keys storage model, why naive postmeta edits silently no-op, and how MCP element-writes route the right area automatically."
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

# Bricks: header & footer templates

Header, footer, and content elements live on the **same** `bricks_template` (or normal page) post: but in **different postmeta keys**. Get the key wrong and your write silently lands in a meta no renderer reads. Most "I edited the header but nothing changed" tickets come from this.

## The three meta keys

Defined in root `functions.php`:

| Constant | Default value | Holds |
|---|---|---|
| `BRICKS_DB_PAGE_HEADER` | `_bricks_page_header_2` | Header element tree |
| `BRICKS_DB_PAGE_CONTENT` | `_bricks_page_content_2` | Content / page-body element tree |
| `BRICKS_DB_PAGE_FOOTER` | `_bricks_page_footer_2` | Footer element tree |

Each meta value is a serialized PHP array of element objects. Same shape across all three: only the meta key differs.

A `bricks_template` post with `_bricks_template_type = 'header'` stores its tree in `_bricks_page_header_2`, **not** in `_bricks_page_content_2`. Reading `_bricks_page_content_2` on that post returns `''` and your render is blank.

## Area lookup: `Database::get_data()` and `get_bricks_data_key()`

Bricks core has two helpers that you should mirror in any custom code:

```php
\Bricks\Database::get_bricks_data_key( $area );  // 'header' | 'footer' | 'content'
\Bricks\Database::get_data( $post_id, $area );   // returns the element tree
```

`$area` is `'header'`, `'footer'`, or `'content'`. Pass the wrong area and you'll silently read/write the wrong tree.

The Bricks Save_Pipeline also accepts area: `Save_Pipeline::execute( $post_id, $elements, $area )`.

## How MCP element-writes pick the area

The Bricks MCP element-write abilities (`add-element`, `update-element`, `remove-element`, `set-page-elements`) **infer the area from the post's template type**:

- Post type `bricks_template` + `_bricks_template_type = 'header'` -> area `'header'` -> reads/writes `_bricks_page_header_2`.
- Post type `bricks_template` + `_bricks_template_type = 'footer'` -> area `'footer'` -> `_bricks_page_footer_2`.
- Anything else (regular pages, posts, content templates, archive templates, popup templates) -> area `'content'` -> `_bricks_page_content_2`.

You don't have to specify the area in the call. Just pass `postId` and the element id: the routing is automatic.

## The `<header>` / `<footer>` wrapper is automatic: don't double up

When Bricks renders a header or footer template on the frontend, it **wraps the entire element tree in a semantic landmark for you**:

- Header template content -> emitted as `<header bricks-data>...your tree...</header>` (`includes/frontend.php:1062`).
- Footer template content -> emitted as `<footer bricks-data>...your tree...</footer>` (`includes/frontend.php:1150`).

So the root element of a header template should **not** carry `tag: "header"` (or `tag: "custom"` + `customTag: "header"`). Same for footer. Doing so produces nested `<header><header>...</header></header>`: invalid HTML5 landmarks, accessibility regression, and triggers the "duplicate `<header>`" rule in axe / WAVE.

**The right defaults inside a header/footer template:**

- Use a `section` element for the top-level layout (it renders as `<section>` by default, which is fine inside a `<header>` landmark).
- Or a `block` / `container` element with `tag: "div"` if you don't want a section landmark either.
- For the navigation row: `nav` is a valid tag on a container/section, AND it's correct inside a `<header>`: different landmarks, no nesting conflict.

**A common safe shape for a header template:**

```
section (tag: section, default)
`-- nav-nested or block (tag: nav)
    |-- logo image
    `-- menu items
```

Nothing here sets `tag: header`. The wrapping `<header>` comes from the renderer.

**Same rule for footers.** The footer template's root should be a `section` or `block` (not `tag: footer`). Bricks adds the `<footer>` wrapper when it renders.

**Why this goes wrong:** It is tempting to map "this is a header" to "emit `<header>`." It's semantically correct in plain HTML but wrong inside a Bricks header template, because Bricks already added the landmark. Always ask: *is this template type already wrapped?* For header / footer: yes.

Note: the `tag` control's built-in option set on container/section/block does not include `header` or `footer`: those are reachable only via `tag: "custom"` + `customTag: "..."`. If you find yourself reaching for the custom escape hatch to set `header`, that's the cue you're double-wrapping.

## Why naive postmeta writes break

These all silently no-op or corrupt the tree:

- Writing element JSON to `_bricks_page_content_2` on a header template (wrong key: no renderer reads it).
- Writing without `wp_slash()`: element values containing `\\` get unslashed by `update_post_meta` and the next read returns broken data.
- Writing without going through `Save_Pipeline::execute`: bypasses revision creation, queryId reindex, and filter-index rebuild. Visible until next save, then mangled.
- Bulk-replacing the array without preserving global elements / global classes references: turns connected classes into orphans.

## Header / footer template lookup

Bricks finds the active header/footer template via `find_template_id( 'header' | 'footer' )`: same scoring as content templates (see `bricks-templates-conditions` skill). The highest-scoring matching template wins.

If no header template matches, **no header is rendered**. The `<body>` opens straight into the page content. This is why a blank header is the #1 "the site looks broken" symptom on fresh installs: nobody created a header template yet.

Best fallback: one header + one footer template, each with `conditions: [{ "main": "any" }]` (NOT `entireWebsite`). Then add specific overrides per section.

## Common authoring patterns

### "Add a logo to the existing header"

1. `list-templates` filtered by `type: header` -> find the active header template id.
2. `get-page-structure (postId: <header-id>)` -> see the existing tree (Bricks routes correctly).
3. `add-element (postId: <header-id>, parentId: <nav-container-id>, element: { name: "image", settings: { image: { url: "..." } } })` -> write goes to the header meta automatically.
4. Verify by reloading the frontend or calling `get-page-elements (postId: <header-id>)`: confirm the new element id appears in the tree.

### "Make the footer the same on all pages"

It already is, by default. Footer template with `{ "main": "any" }` is global; no per-page overrides needed unless you create them. If a specific page has its own footer, you (or the user) created a more-specific condition somewhere.

### "I edited an element but the change isn't visible"

Order of investigation:
1. Did the write hit the right post? `update-element` returns the postId: confirm it matches the visible header/footer.
2. Are there multiple header/footer templates with overlapping conditions? Check scoring (`bricks-templates-conditions` skill).
3. Is the page cached? Bricks caches CSS per-post; a settings change may need a CSS regen (`regenerate-css-files` ability or "Regenerate CSS files" in admin).
4. Is the element inside a component? Component changes need a re-render of every host post (`regenerate-css-files` again).

## "It changed in the builder but not on the frontend"

Builder runs an unsaved version in memory; frontend reads the persisted meta. If save failed (lock, save endpoint error, hook error), the builder shows the new state but the frontend serves the old one.

Verify by reading the meta directly:

```
get-page-elements (postId)
```

If the meta is the old version, the save didn't land. Look for: locked-by-other-user errors, save endpoint errors, or hook errors in the PHP error log.

## Page-vs-template: when you actually own the header

For pages (`page` post type), Bricks first looks for a matching header template. If none matches, the page renders without a header. **Pages don't have their own per-page header by default**: the header is always template-driven.

If you need a page-specific header: create a header template scoped to that page (`{ "main": "ids", "ids": [42] }`).

## Never do

- Write directly to `_bricks_page_content_2` on a header or footer template post: silently lost.
- Pass an `area` arg to MCP element abilities expecting it to override the auto-routing: the abilities derive area from template type.
- Edit header/footer trees through `wp_update_post` content fields: Bricks doesn't render from `post_content`.
- Forget to `wp_slash()` an array of elements before `update_post_meta` if you're writing in custom PHP. Bricks core's Save_Pipeline does this for you.
- Assume "no header on this page" means there's a bug. It usually means no header template matches the page's conditions.

## Related abilities

- `list-templates (type: header|footer)`: find existing templates of each type.
- `get-template`, `create-template`, `delete-template`: template CRUD; use `set-template-settings` or `set-template-conditions` for settings and conditions. The template `type` controls which Bricks data area the renderer reads.
- `set-template-conditions`: control which pages a header/footer applies to.
- `add-element` / `update-element` / `remove-element` / `set-page-elements`: area-aware element writes.
- `regenerate-css-files`: force a CSS rebuild when style changes don't propagate.

## Related skills

- `bricks-templates-conditions`: full scoring rules for which header/footer wins on a given page.
- `bricks-nestable-elements`: Nav Nested + Offcanvas live almost exclusively in headers.
- `bricks-mega-menus`: Bricks-native Nav Nested mega menus and WordPress menu-backed mega menu setup.
- `bricks-quality-gate`: the verify-after-write loop that catches silent header/footer regressions.
