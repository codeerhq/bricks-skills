---
name: bricks-element-schemas
description: "Use before writing or editing Bricks element JSON, settings, controls, globals, page settings, or template settings. Gives the runtime lookup order plus bundled full resolved schemas so you can check exact control keys and value shapes instead of guessing."
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

# Bricks: element schemas

Use this skill when a write needs exact element keys, control value shapes, CSS-mapped settings, inherited controls, globals, page settings, template settings, or schema validation.

The runtime Bricks MCP and the bundled resolved schemas answer different questions:

- **Runtime MCP:** what this connected site actually has installed and registered.
- **Bundled schemas:** how Bricks values are shaped, especially complex controls such as `image`, `link`, `typography`, `query`, `repeater`, `form`, `interactions`, and responsive/pseudo-class setting keys.

Use both for non-trivial writes. Runtime first, bundled value schema second.

## Element IDs vs frontend IDs

Bricks element `id` is an internal builder identifier and is also used in the default frontend selector `#brxe-{id}`. When you set it yourself, it must be exactly 6 characters. In nested `{name, children}` input, you may omit ids and Bricks will generate them while preserving parent-child nesting. In flat arrays, provide or preserve valid 6-character ids for every `id`, `parent`, and `children` reference.

Do not use element `id` for human-readable anchors such as `hero` or `pricing-section`. Bricks renders `id="brxe-{id}"` by default. Only set `settings._cssId` when you intentionally need a custom HTML id instead of the default Bricks id.

## Lookup order

1. **Connected Bricks site:** prefer runtime MCP.
   - List element types with `bricks-list-element-types`.
   - Get one element with `bricks-get-element-schema`.
   - If the direct tool is missing, call the dispatcher with `ability_name: "bricks/get-element-schema"`.

2. **Bundled full resolved schemas:** use the scripts in this skill. The pack includes the resolved schema bundle for elements, controls, global data, page settings, template settings, and general content-area structure.

3. **Local Bricks repo or generated bundle:** if you are developing Bricks itself, use the scripts against `schema-docs-bundle/schema-resolved` or `includes/schema` to match the checkout exactly.

4. **Academy docs:** use deployed schema docs only when the local skill bundle is unavailable or you need to compare against published docs.

Do not load every schema into context. Fetch the one element/control/global schema you need.

## When to fetch a schema

Fetch the schema before writing if:

- The element type is uncommon, complex, WooCommerce-specific, or nestable.
- You are editing an element already present on the site and you do not know its control keys.
- You are writing media, form, query, interaction, condition, selector, or responsive/pseudo-class settings.
- You are converting HTML and the converter output includes a fallback `code` element or a complex element such as `form`.

For simple repeated builds, default to the small core set in `references/common-elements.md`, then fetch exact schemas only for the elements and controls you actually use.

## Scripts

From this skill directory:

```bash
node scripts/list-schemas.mjs --schema-root /path/to/bricks/schema-docs-bundle/schema-resolved
node scripts/get-schema.mjs element image --schema-root /path/to/bricks/schema-docs-bundle/schema-resolved
node scripts/get-schema.mjs element form --schema-root /path/to/bricks/includes/schema
node scripts/get-schema.mjs element image --compact --settings image,altText,loading
node scripts/get-schema.mjs control image --compact
node scripts/get-schema.mjs general content-area --compact
node scripts/get-schema.mjs element image --list-settings
node scripts/list-schemas.mjs --schema-root references/schema-resolved
node scripts/list-schemas.mjs --common
node scripts/list-schemas.mjs --converter
```

If `--schema-root` is omitted, scripts search upward from the current directory for:

- `schema-docs-bundle/schema-resolved`
- `includes/schema`
- `references/schema-resolved` inside this skill

Use `--compact` when you need value shapes without loading a full element schema. Use `--settings key1,key2` to limit an element schema to the controls you plan to write.

## Static manifest

`references/schema-manifest.json` is a compact discovery manifest generated from the Bricks schema source. Use it to decide what exists and whether an element is common, nestable, WooCommerce-specific, or supported by the HTML-to-Bricks converter.

The manifest is not the schema. Treat it as a map, then fetch the exact schema on demand.

This skill bundles the full resolved schema set. Do not paste the whole bundle into context. Read one element, one control, or one settings file at a time.

## Common build bias

Most maintainable Bricks sites use a small set of elements many times:

- Layout: `section`, `container`, `block`, `div`
- Content: `heading`, `text-basic`, `button`, `image`, `icon`
- Reuse/data: query-loop settings on layout elements, components, dynamic tags
- Navigation/forms when needed: `nav-nested`, `form`

Prefer these for new builds unless the user asks for a specific widget or the existing page already uses one. For less-used elements, fetch the schema before editing.

## HTML-to-Bricks converter coverage

The converter intentionally uses a limited element set. It currently maps to:

`section`, `div`, `heading`, `text-basic`, `text-link`, `icon`, `button`, `image`, `svg`, `video`, `audio`, `code`, `divider`, `form`.

Treat converted output as a starting point. If the source implies sliders, accordions, tabs, product widgets, maps, filters, or query-driven cards, convert the static structure first, then replace or refine with the proper Bricks element schema.

## Never do

- Do not guess setting keys for complex elements.
- Do not invent long or semantic element `id` values. Use an exact 6-character internal id, or omit ids only in nested children format. Only set `settings._cssId` when a custom HTML id is explicitly needed.
- Do not paste full schema bundles into a prompt.
- Do not use Academy/static schemas over runtime MCP when connected to the actual site.
- Do not write raw post meta directly. Use Bricks abilities so validation, revisions, and permissions run.
