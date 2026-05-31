---
name: start-here
description: "Use at the start of every Bricks session. Orientation rules: call get-design-context before any design-system write, verify mutations with get-page-elements / list-revisions, and never force same-named globals to duplicate."
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

# Bricks: start here

You are working against a **Bricks Builder** site via the Bricks MCP. Every request that touches the design system, page elements, templates, or components runs through abilities. Ability readbacks are authoritative for the connected site's current state. Bundled schemas explain valid value shapes, but they do not replace runtime reads.

> **If a `bricks/*` ability is not available as a direct tool**: first check whether it is outside the fast path and call it through `mcp-adapter-execute-ability` with `ability_name: "bricks/<name>"`. If the dispatcher also rejects it, call `bricks-list-ability-status` to check whether a site admin disabled it under Bricks > Settings > AI.

Disabled abilities remain inspectable through adapter get-info/discovery, but execution returns `bricks_ability_disabled`. Some sensitive categories, such as builder-permission management, are default-off until an admin explicitly enables them. Do not retry or route around that error.

## Ability access

Ability names use slashes, for example `bricks/get-design-context`. Direct MCP tool names use hyphens, for example `bricks-get-design-context`.

Bricks has a direct-tool fast path plus dispatcher-only abilities. If an enabled `bricks/*` ability is not in `tools/list`, call it through `mcp-adapter-execute-ability` with `ability_name` and `parameters`. Use `bricks-list-ability-status` to distinguish dispatcher-only from disabled.

## WooCommerce

If WooCommerce exposes its own MCP/Abilities surface, use WooCommerce-owned abilities for product and order operations. Use Bricks WooCommerce abilities for Bricks setup: pages/templates, presets, modular Woo elements, and setup-related Woo options.

## Non-negotiables

1. **Orient first.** Before creating any design-system resource (global class, variable, component, color), call `bricks-get-design-context` with `responseFormat: "summary"` and check whether something comparable already exists. Its component summaries include labels and descriptions; when an existing component clearly fits a new page, section, card, or repeated pattern, inspect it with `bricks/list-components` or `bricks/get-component` and consider reusing it instead of recreating the same structure. Use the returned `breakpoints` when writing responsive CSS or media queries.

2. **Load the task skill before the first write.** If you are about to author a design system, load **design-systems** or **seed-design-system**. If you are creating, updating, extracting, instancing, or deleting components, load **components**. If you are setting template conditions, load **templates-conditions**. If you are writing element `_conditions`, load **element-conditions**. If you are writing element `_interactions`, load **interactions**. If you are creating a new visual section, page, or template shell, load **html-css-to-bricks**. Do this before writing data, not after the first error.

3. **Prefer HTML-first for new visual shells.** For greenfield page sections, full pages, and static template shells, write clean semantic HTML/CSS, run `bricks/convert-html-css-to-bricks-data`, then persist the converted tree. After conversion, do one focused data pass: replace static text/images/links with dynamic data where appropriate, and replace repeated static cards/items with query loops. Direct Bricks JSON authoring is better for small targeted edits or element settings the converter cannot represent. Do not hand-author `_cssCustom` for ordinary layout, spacing, typography, colors, backgrounds, or borders.

4. **Never force duplicates.** All design-system abilities enforce unique names. If you get `bricks_conflict_duplicate_{resource}_name`, the site already has that name: read the existing resource with `list-*` or `get-*`, then decide: rename your new one, update the existing one, or abort.

5. **Verify writes.** Element-tree writes such as `bricks-set-page-elements`, `bricks-add-element`, `bricks-update-element`, `bricks-batch-update-elements`, `ability_name: "bricks/update-element-conditions"`, `ability_name: "bricks/update-element-interactions"`, `bricks-remove-element`, `ability_name: "bricks/insert-template"`, `ability_name: "bricks/insert-remote-template"`, and `ability_name: "bricks/extract-component-from-elements"` return `revisionId`. When a write returns one, call `bricks-list-revisions` for that post to confirm the snapshot exists, then `bricks-get-page-elements` to confirm the new tree matches your intent. For `bricks/create-component` and `bricks/update-component`, read back with `ability_name: "bricks/get-component"` and confirm `_version`, properties, variants, slots, and nested component props. Component updates and deletes require `expectedDesignSystemVersion` from a recent read; component deletes also require the reviewed `expectedUsageCount`. Do not assume success from a 200 response alone.

6. **Do not guess element settings.** Before writing an unfamiliar element, a complex control, or any media/query/form/interaction/condition setting, call `bricks-get-element-schema` or dispatch `ability_name: "bricks/get-element-schema"`. Then use the `element-schemas` skill for the control value schema when the runtime payload only says `type: "image"`, `type: "query"`, `type: "typography"`, `type: "repeater"`, etc.

7. **Element IDs are internal and frontend-used.** Bricks element `id` values must be exactly 6 characters. They are used by builder references and by the default frontend selector `#brxe-{id}`. In nested `{name, children}` input, you may omit ids and Bricks will generate them while preserving parent-child nesting. In flat arrays, provide or preserve valid 6-character ids for every `id`, `parent`, and `children` reference.

8. **Destructive writes need user sign-off.** Abilities annotated `destructive: true` can be unrecoverable, remove global data, or leave orphan references. Check `bricks-list-ability-status` for the annotation, show the relevant `beforeDelete` snapshot or revision plan, and wait for explicit confirmation before invoking them.

9. **Post revisions are the only automatic undo.** Bricks post revisions are snapshotted automatically on element writes. Global-data writes (classes, variables, theme styles, components, breakpoints, pseudo-classes) are not revision-tracked. Use `import-global-data` with `dryRun: true` first, and use explicit replace preconditions when restoring from an exported global-data bundle.

## Workflow order

For any non-trivial change:

1. `bricks-get-mcp-version` once per session: record the Bricks, abilities, adapter, and WordPress versions you are working against.
2. `bricks-get-design-context` with `responseFormat: "summary"`: orient on current tokens, components, palettes, and breakpoints. For new sections or pages, check whether existing component names/descriptions suggest reusable building blocks.
3. Load the task-specific skill before the first write: **design-systems** / **seed-design-system**, **templates-conditions**, **element-conditions**, **interactions**, **html-css-to-bricks**, **query-loops**, **filters**, **forms**, or **components**.
4. `bricks-list-cms-sources`: if the change touches dynamic content, see what post types / custom fields exist.
5. **If placing any dynamic data tag (`{acf_*}`, `{cf_*}`, or any provider-specific tag):** call `mcp-adapter-execute-ability` with `ability_name: "bricks/list-dynamic-data-tags"` and `parameters: { postId: <id> }` from the relevant post type to enumerate every valid tag. Then use the same dispatcher with `ability_name: "bricks/preview-dynamic-tag"` for each tag you intend to write. If `unknownTags` is non-empty, the tag name is wrong: fix it before writing. **Never guess a tag name.**
6. For new static visual shells, write HTML/CSS and run `bricks/convert-html-css-to-bricks-data` before saving. For Bricks-native behavior, fetch the runtime element schema and consult `element-schemas` for complex control value shapes.
7. Perform the mutation. Capture `revisionId` when the response includes one.
8. Read back with `bricks-get-page-elements` / `ability_name: "bricks/get-component"` / `bricks-list-global-classes`.
9. If a browser or screenshot tool is available, load **browser-verify** and visually verify important pages after broad element/template writes.
10. Report what was created/changed, what the revision id is, and what to click in the builder to see it.

## Things that will go wrong

- **"Conflict" error on the first write.** Always means a resource with that name exists. Don't retry with a suffix: read the existing one first.
- **Empty post element tree.** The post isn't Bricks-enabled, or the area key is wrong (try `content`, `header`, `footer`: most posts use `content`).
- **`get-design-context` takes 3+ seconds on first call with `includeUsage: true`.** Normal: it scans every Bricks post. Result cached 1 hour; busted on every design-system write.
- **`preview-dynamic-tag` returns the tag string verbatim.** The provider is missing or the post id is wrong. Check `bricks-list-cms-sources` to see what's actually installed.
- **Template conditions accept arrays, not scalar strings.** Use `postType: ["<post-type-slug>"]`, `archiveType: ["postType"]`, and `archivePostTypes: ["<post-type-slug>"]`. Load **templates-conditions** before writing template conditions.
- **Element conditions use OR groups of AND items.** Use `update-element-conditions` with `conditions: [[{ key, compare, value }]]`. Pass `conditions: []` to clear them.
- **Element interactions can be inherited from global classes.** Use `get-element-interactions` and check `effectiveInteractions` before replacing element-level rows.
- **`bricks_invalid_element_id`.** You supplied a human-readable, missing, or long element `id` where Bricks needed an internal id. Use valid 6-character ids for flat references, or switch to nested children format where ids may be generated.
- **Variables saved uncategorized.** `get-design-context` returns `variableCategories`; match existing category IDs and prefixes. For typography and spacing scales, use `bricks/generate-scale-variables` instead of hand-authored static values. `set-global-variables` rejects hand-authored static values that target a configured scale prefix.
- **Custom CSS selectors.** Prefer native settings or `bricks/convert-html-css-to-bricks-data`. When `_cssCustom` is truly needed, write a full CSS rule with the persisted selector: `#brxe-{id}` for standalone elements, `.brxe-{id}` inside component definitions, and `.{class-name}` for global classes.

## What this site has

- **Bricks version:** call `bricks-get-mcp-version`: match against release notes if you need a specific feature.
- **Installed design system:** call `bricks-get-design-context` with `responseFormat: "summary"`.
- **Available CMS sources:** call `bricks-list-cms-sources`.
- **Available dynamic data providers and modifiers:** call `mcp-adapter-execute-ability` with `ability_name: "bricks/list-dynamic-data-tags"` and `parameters: { includeModifiers: true }`.

## Sibling skills

- Authoring a design system: **design-systems**, **seed-design-system**
- New visual sections/pages/templates from HTML/CSS: **html-css-to-bricks**
- Template condition setup/scoring: **templates-conditions**
- Element display conditions: **element-conditions**
- Element interactions and popup/open/scroll behavior: **interactions**
- Auditing the site: **audit-design-system**, **site-audit**
- Planning a change from a user brief: **plan-from-brief**
- Enforcing naming: **naming-conventions**
- Feature-specific gotchas: **query-loops**, **components**, **custom-code**
- Exact element/control schemas: **element-schemas**
- Uploading and wiring images/media: **media-assets**
- Browser/screenshot verification: **browser-verify**
