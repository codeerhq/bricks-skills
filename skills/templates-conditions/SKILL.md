---
name: templates-conditions
description: "Use when creating or debugging Bricks templates: \"make an archive template for this CPT\", \"why does this template show on the wrong page?\", \"which template wins here?\". Covers the 8 normal template types plus password protection, condition precedence, archive vs single vs search resolution, and the one-template-wins rule."
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

# Bricks: templates & conditions

Bricks templates are WP posts of the `bricks_template` custom post type, tagged with a `_bricks_template_type` meta (`'header'`, `'footer'`, `'content'`, etc.) and gated by display **conditions**. For every page the site renders, Bricks picks **one template per part** (header, footer, content) by scoring conditions: the highest score wins. WooCommerce adds extra template types when its integration is active. Use this as the condition-selection reference for the normal Bricks template flow.

## The 8 normal template types plus password protection

Normal template types are registered in `includes/setup.php`. `password_protection` is a conditional template type used by password protection. Post_meta constant `BRICKS_DB_TEMPLATE_TYPE = '_bricks_template_type'` (`functions.php`).

| Value | Purpose | Eligible contexts |
|---|---|---|
| `header` | Site header | All pages (one winner per page) |
| `footer` | Site footer | All pages |
| `content` | Single-post body ("Single") | `is_singular()`: single posts, pages, CPTs |
| `section` | Reusable content block | Inserted via the Template element: doesn't self-render |
| `popup` | Popup template | Rendered when conditions match + an interaction opens it |
| `archive` | Archive layout | `is_archive()`, `is_post_type_archive()`, taxonomies, authors, dates |
| `search` | Search results | `is_search()` |
| `error` | 404 page | `is_404()` |
| `password_protection` (conditional) | Password gate | When WP password-protection is active on a post |

Each template post has one type value (via the meta). `section` is special: it doesn't self-render; it's used by the Template element inside other templates.

## The one-template-wins rule

For each render part (header, content, footer), Bricks iterates every template of that type, scores each template's conditions against the current request, and picks the **highest-scoring template**. Do not rely on same-score ties: the source stores matches by score, so a later template at the same score can replace an earlier one based on query iteration order.

Resolution logic: `includes/database.php:625-708` (`find_template_id()`).

**All templates that didn't win are silently skipped.** No warning, no log. If your new template doesn't show, it's because an older/higher-scored template beat it: not because Bricks is broken.

## Condition scoring (0 -> 10, plus boosts)

From `includes/database.php::screen_conditions()`. Higher = more specific = wins.

| Score | Condition match | Example |
|---|---|---|
| 0 | No conditions | Ultimate fallback |
| 1 | Template type matches content type | Search template on a search page |
| 2 | `main: any` | Entire website |
| 3 | `main: archiveType` with `archiveType: any` | Any archive page |
| 4 | Any term archive with no `archiveTerms` list | All taxonomy archives |
| 7 | Singular post-type match, all CPT archives with `archivePostTypes` omitted, or runtime `taxonomy::all` term-archive match | All posts of type Product |
| 8 | Child pages of specific IDs, assigned terms, specific archive CPT, author, date, search/error, or specific term archive | Archive of `product_cat: deals` |
| 9 | Front page | `main: frontpage` |
| 10 | Specific post ID via `main: ids` | Exactly post id 42 |
| +100 | Password-protection templates | Password protection wins over normal templates |

**Implication:** a template with `main: any` (score 2) gets beaten by a template with a post-type match (score 7 or 8) on that post type. Use `any` as the base fallback, then create specific templates that win on their pages.

## Content-type resolution: what page is this?

From `database.php:489-525`. WP context -> Bricks content_type:

| WP function | content_type |
|---|---|
| `is_singular()` | `content` |
| `is_post_type_archive()`, `is_tax()`, `is_category()`, `is_tag()`, `is_author()`, `is_date()` | `archive` |
| `is_search()` | `search` |
| `is_404()` | `error` |

Filterable via `bricks/database/content_type` (`database.php:518`): useful for custom routing plugins.

Then `find_template_id()` picks a template of the matching type whose conditions score highest.

## The condition data structure (canonical)

Stored in `_bricks_template_settings` meta, under the `templateConditions` key.

The MCP `set-template-conditions` ability accepts the conditions array at the top level:

```json
{
  "templateId": 123,
  "conditions": [
    { "main": "any" },
    { "main": "frontpage" },
    { "main": "postType", "postType": ["post", "page"] },
    { "main": "archiveType", "archiveType": ["postType"], "archivePostTypes": ["product"] },
    { "main": "search" },
    { "main": "error" },
    { "main": "terms", "terms": ["category::5", "product_cat::12"] },
    { "main": "ids", "ids": [42, 89] },
    { "main": "any", "hookName": "woocommerce_after_main_content", "hookPriority": 10 }
  ]
}
```

Bricks stores that array as `_bricks_template_settings.templateConditions`.

The `main` enum is exactly: `any`, `frontpage`, `postType`, `archiveType`, `search`, `error`, `terms`, `ids`, `hook`. `hook` is accepted by the MCP validator for legacy/convenience input, but `set-template-conditions` stores it as `any` when `hookName` is present (`includes/abilities/templates.php:1006-1014`). **Do not invent kinds.** In particular:
- `any` (NOT `entireWebsite`)
- `terms` (NOT `archiveTerm`)
- `hookName` is for **section templates only**: it injects the section's content at the named WP action.

Term identifiers accepted by `set-template-conditions` depend on the condition key:

- `terms`: strings in `taxonomy::id` form, e.g. `"category::5"`, `"product_cat::12"`. Do not send raw term IDs or term objects.
- `archiveTerms`: strings in `taxonomy::id` or `taxonomy::all` form, e.g. `"category::5"`, `"product_cat::all"`. The `taxonomy::all` branch is archive-only (`includes/database.php:1049-1054`).

**Multiple conditions in the array = OR.** Any single condition match wins. No explicit AND groups (unlike some other systems).

## Header + footer: always chosen, rarely unique

Every page gets a header and a footer. If no custom header template matches, Bricks renders *nothing*: the page's `<body>` is just the content area. **This is why new sites look "broken" before the user creates a header template.**

Best practice: a single header template with `{ "main": "any" }` (score 2) as the base, then variants for specific sections if needed.

See the `headers-footers` skill for the meta-routing rules MCP element-write tools follow when editing header/footer template trees.

## Archive template: the CPT trap

To create a CPT archive layout:
1. Template type = `archive`.
2. Condition: `{ "main": "archiveType", "archiveType": ["postType"], "archivePostTypes": ["product"] }`.
3. On the frontend, `/product/` (or whatever the CPT's archive slug is) will now use this template.

**Trap:** if the CPT has `has_archive = false` in its registration, there's no archive URL and the template has no context to render in. Fix the CPT registration or use a regular page + a Posts loop instead.

## Search + error templates

- `search`: triggered by `?s=query` or `/?s=query`. Use `{ "main": "search" }` for search-results templates. Do not use `{ "main": "any" }` unless you intentionally want a broad body-template fallback, because Bricks scores all body-type templates together.
- `error`: 404 template. Conditions typically `{ "main": "any" }` too.

If you don't create them, WP falls back to the default theme files (which Bricks sometimes renders minimally, sometimes not at all, depending on theme).

## Preview mode: testing template conditions

In the builder, the top-right has a **Preview as** dropdown. Use it to simulate different content types: Bricks evaluates conditions against the simulated context.

It does not simulate every frontend route, custom query, or plugin filter perfectly. For those, view the frontend.

## Related hooks

| Hook | Purpose |
|---|---|
| `bricks/database/content_type` | Override the WP context -> Bricks content_type mapping (`database.php:518`) |
| `bricks/active_templates` | Mutate the list of active templates after resolution (`database.php:606`) |
| `bricks/get_templates` | Filter the full template query result (`templates.php:954`) |
| `bricks/render_with_bricks` | Whether Bricks renders at all for this request (`helpers.php:1741`) |

See `hooks-reference` for the complete template hook list.

## "No condition" templates: inert fallbacks

A template with **no conditions** does not match through `screen_conditions()` itself. `find_template_id()` adds narrow fallbacks for some template types: header/footer can score 0 when default templates are enabled, and a template whose type matches the current content type can score 1. Do not use empty conditions as a normal site-wide rule; use `{ "main": "any" }` instead.

## Silent-failure debug order

1. **Template doesn't show where expected?**
   a. Open the builder -> the template -> Template settings -> Conditions. Does the current page match at all?
   b. Another template of the same type has a higher score. Check `WP Admin > Bricks > Templates`: compare conditions across all templates of the same type.
   c. Condition uses a CPT or taxonomy slug that changed. Slugs don't get live-migrated.

2. **Template shows where not expected?**
   a. `main: any` on a template that should be specific. Replace with a more specific condition.
   b. Condition list has an extra OR entry that's too broad.

3. **Multiple templates "should" render, only one does?**
   a. Working as designed. Only one template per part wins. Use the Template element (inserts a `section` type) to compose.

4. **Header is empty / page has no header?**
   a. No header template matches. Create one with `{ "main": "any" }` as fallback.
   b. Header template exists but its conditions do not match the current page.

5. **Archive template not rendering on the CPT archive?**
   a. CPT has `has_archive = false`: no archive URL exists.
   b. Condition uses `archiveType: any` but the page is a taxonomy archive, not the CPT archive. Use a separate `terms`-based condition for taxonomy.

6. **Content template wins but you wanted the "single" default?**
   a. A `content` template with score 2+ beats WP's default single. Remove the unwanted condition or delete the template.

## Never do

- Set `main: any` on a `content` template unless you really want it to cover every singular page.
- Create 10 templates with overlapping conditions and hope the "right one wins": it's deterministic, not magical. Use the scoring table.
- Mix `main: any` with other conditions expecting AND semantics. Conditions are OR. If you need AND, author a single `main: ids` with the specific list.
- Move a template's type from `archive` to `content` after it's been used: existing conditions assume the old type's rendering context.
- Forget that `section` templates don't self-render. They're building blocks for the Template element.
- Pass `entireWebsite` or `archiveTerm` as `main`: those names exist nowhere in the schema and will be rejected.

## MCP abilities relevant here

- `list-templates`: enumerate all templates with type + conditions.
- `get-template`: full template content + settings.
- `create-template`, `delete-template`: template CRUD. Use `set-template-settings` and `set-template-conditions` for settings and condition changes.
- `set-template-conditions`: replace the `templateConditions` array (uses the canonical shape above).
- `duplicate-post`: copies a template including conditions and regenerates element ids.

## Related skills

- `headers-footers`: header/footer template rules + meta routing for element writes.
- `popups`: covers popup-type templates specifically.
- `query-loops`: covers archive/content template queries.
- `components`: for `section`-type templates and reusable content.
