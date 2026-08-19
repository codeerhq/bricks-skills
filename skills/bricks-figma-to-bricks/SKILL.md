---
name: bricks-figma-to-bricks
description: "Use when porting a Figma frame, page, or design system into Bricks: \"convert this Figma design\", \"build this from the Figma file\", \"import Figma tokens\". Covers the Figma integration handoff, token mapping to color and global-variable abilities, structure via convert-html-css-to-bricks-data, components via create-component, and end-to-end verification via the bricks-browser-verify skill."
---

**Requires:** Bricks 2.4+ with the Abilities API enabled

# Bricks: Figma -> Bricks workflow

No new Bricks abilities here. This workflow composes existing abilities. It sequences existing Bricks abilities (`create-color`, `set-global-variables`, `convert-html-css-to-bricks-data`, `create-component`, `find-post`) with an available Figma integration and a browser tool for verification.

This skill is the primary route. Do not load every related skill up front. Load one
companion only when its exact subproblem appears—for example component slots, custom
fonts, or a form—not merely because it is listed below.

If a required integration is not installed, name the missing piece to the user before starting.

## The five-phase order

```
1. Tokens     -> extract colors, spacing, typography from Figma
              -> create-color-palette/create-color + set-global-variables on the Bricks site
2. Theme      -> bind body, heading, link, and background defaults to an active root theme style
3. Components -> identify reusable patterns (cards, buttons, nav)
              -> convert-html-css-to-bricks-data per pattern, wrap via create-component
4. Structure  -> per page/frame: full-frame HTML/CSS -> convert-html-css-to-bricks-data
              -> replace raw elements with references to the components above
5. Verify     -> open permalink in browser, screenshot vs Figma, iterate
```

Skip any phase and the output drifts. Tokens before structure means every class references a variable instead of a hex. Components before pages means repeated patterns aren't DRY. Verify last means misalignments compound.

## Phase 1: Tokens

### Colors

Ask the Figma integration for the file's design-token export or variable collection. Expected shape varies by tool: common outputs:

```
- Primary/500:  #4F46E5
- Primary/600:  #4338CA
- Neutral/900:  #0F172A
- Neutral/50:   #F8FAFC
- Accent:       #F59E0B
```

Read `list-color-palettes` first and preserve its resource `ownership`. Create or
reuse the target palette, then add colors via `create-color`. Every palette/color
create must pass the latest palette resource ownership; carry the `ownership` from
each successful mutation into the next call. Current `create-color` takes
`paletteId` and color values such as `light`, not `name`, `hex`, or a palette label:

```
create-color-palette({ name: "Primary", expectedOwnership: palettes.ownership })
// -> { palette: { id: "<generated-palette-id>", name: "Primary", colors: [] } }

create-color({ paletteId: "<generated-palette-id>", light: "#4F46E5", raw: "var(--color-primary-500)", expectedOwnership: createdPalette.ownership })
create-color({ paletteId: "<generated-palette-id>", light: "#4338CA", raw: "var(--color-primary-600)", expectedOwnership: firstColor.ownership })
create-color({ paletteId: "<generated-palette-id>", light: "#F8FAFC", raw: "var(--color-neutral-50)", expectedOwnership: secondColor.ownership })
```

Bricks palette colors are stored as palette color objects. Derive `raw` variable names
from explicit Figma token names, not merely from palette labels. A color with both a
value and `raw: "var(--name)"` emits that CSS variable; do not duplicate the same name
in global variables.

### Typography, spacing, radius, shadows

These don't have a color-specific ability: they live in global variables. Category
values are saved category IDs, not labels. Reuse IDs from `list-global-variables`;
if categories are missing, create them through the complete-list,
ownership-guarded `set-global-variable-categories` workflow first. Then use
`set-global-variables`:

```
// Read list-global-variables once immediately before this write.
set-global-variables({
  variables: [
    { name: "space-1",  value: "4px",   category: "<spacing-category-id>" },
    { name: "space-2",  value: "8px",   category: "<spacing-category-id>" },
    { name: "space-4",  value: "16px",  category: "<spacing-category-id>" },
    { name: "space-8",  value: "32px",  category: "<spacing-category-id>" },
    { name: "radius-sm", value: "4px",  category: "<radius-category-id>" },
    { name: "radius-md", value: "8px",  category: "<radius-category-id>" },
    { name: "shadow-sm", value: "0 1px 2px rgb(0 0 0 / 0.05)", category: "<shadow-category-id>" },
    ...
  ],
  expectedVariableOwnership: globals.variableOwnership,
  expectedCategoryOwnership: globals.categoryOwnership
})
```

Use `generate-scale-variables` to preview a regular scale. It rejects `save: true`;
persist the reviewed rows through `set-global-variables` with fresh variable and
category ownership values. See
**bricks-design-systems** when the category itself must be created or changed.

### Typography specifics

Figma typography styles typically produce: font-family, size, weight, line-height, letter-spacing. Bricks theme styles hold type-scale tokens, but for programmatic reuse, mirror each as a global variable:

```
{ name: "font-family-sans", value: "'Inter', system-ui, sans-serif", category: "<typography-category-id>" }
{ name: "text-body",        value: "16px",  category: "<typography-category-id>" }
{ name: "text-h1",          value: "48px",  category: "<typography-category-id>" }
{ name: "weight-bold",      value: "700",   category: "<typography-category-id>" }
```

## Phase 2: Theme defaults

Read `list-theme-styles`. Reuse and update the intended site-wide style, or create a
root style with `conditions: [{ main: "any" }]`; an empty condition list does not
render. Bind the persisted font, type-scale, text-color, link, and page-background
tokens into its settings. Before updating, read the exact record through
`get-theme-styles({ style: id })` and pass its fresh `itemOwnership` as
`expectedOwnership`. Load **bricks-design-systems** only if the Figma system requires
more specific post-type or archive theme styles.

## Phase 3: Components

Before dumping full pages into `convert-html-css-to-bricks-data`, identify repeated patterns. Typical candidates: header, footer, card, CTA, pricing tile, product row.

For each, ask the Figma integration for the pattern's exported HTML + CSS (or convert the design frame to HTML yourself). Feed to `convert-html-css-to-bricks-data`:

```
convert-html-css-to-bricks-data({
  html: "<style>.card { background: var(--color-neutral-50); padding: var(--space-4); }</style><div class='card'>...</div>"
})
```

`convert-html-css-to-bricks-data` returns `{ elements, global_classes, global_variables, ... }`. Persist or remap returned design resources as described in the `bricks-html-css-to-bricks` skill, then wrap the element array via `create-component`:

```
create-component({
  label: "Product Card",
  elements: <elements from convert-html-css-to-bricks-data>,
  category: "Cards"
})
```

`category` is the category label stored on components. Reuse an existing label when
it fits or omit the field.

Result: a component ID. Reuse by referencing the component ID in page-level structure (the `convert-html-css-to-bricks-data` output becomes an instance, not duplicated elements).

### Known `convert-html-css-to-bricks-data` limits

`convert-html-css-to-bricks-data` maps HTML/CSS -> Bricks' closest native element. It **cannot produce**:
- Nestable Sliders (Slider Nestable): needs per-slide structure that CSS can't describe. Author manually via `add-element`.
- Nestable Accordion / Tabs: same: header + content pairs are stateful.
- Nav Nested: menu wiring lives in the element config, not HTML.
- Offcanvas / Popup: those live in separate templates, not page flow.
- Interactions / form field logic: author via `update-element-interactions` and the bricks-forms skill.

For each of the above, convert the static shell via `convert-html-css-to-bricks-data`, then swap the intended native element by hand. Don't expect 1:1 output.

## Phase 4: Structure (per page)

Given a Figma frame for a full page:

1. Ask the Figma integration for HTML + CSS export.
2. Use `find-post` or `create-post` to get a target post. `create-post` returns `permalink`; current `find-post` returns builder metadata but no public permalink. Use another WordPress source for the public URL when working with an existing post.
3. If the final page needs no component-instance injection or other tree surgery, use `commit-html-css-page-import` as the first Bricks operation for a known empty target.
4. Otherwise call `convert-html-css-to-bricks-data`, replace every reusable raw subtree with its component-instance reference in memory, and review the final tree before persistence.
5. Persist/remap the converter's design resources, then call `set-page-elements` once with the final transformed tree. Never save the duplicated raw-component version as an intermediate page.

If the page re-uses the same structure as another page (e.g., two product pages differ only in copy), extract the shared block with `extract-component-from-elements` and re-reference.

## Phase 5: Verify

Compose with `bricks-browser-verify`:

1. Open the permalink from phase 3 with the available browser tool.
2. Screenshot the rendered page.
3. Compare side-by-side with the Figma frame.
4. For each mismatch, identify the element via `get-page-elements`, fix via `update-element`, re-screenshot.

Common first-pass deltas:
- Spacing off by 1 variable step (e.g., `space-4` vs `space-6`).
- Heading uses `h3` semantics but Figma-H2 visual size: fix via element `tag` + typography token.
- Image aspect ratio defaults to `auto` but Figma shows fixed ratio: add CSS aspect-ratio.
- Border radius missing on images (Figma mask -> CSS `border-radius`).
- Nestable Slider empty because `convert-html-css-to-bricks-data` didn't populate children: authored in phase 2 manually.

## The "Figma export quality" trap

Figma plugins that export HTML/CSS vary wildly. Rank in order of fidelity (from real user reports):

| Exporter | Fidelity | Notes |
|---|---|---|
| Figma's native **Dev Mode -> Inspect** with design tokens | Best for tokens | Not a full HTML export; pair with another for structure |
| Anima / Locofy | Medium-high for structure | Verbose CSS; clean up before convert-html-css-to-bricks-data |
| Custom model-assisted HTML export from a frame spec | Variable | Ask for semantic HTML, BEM classes, and CSS variables that match Bricks tokens |
| "Copy as CSS" alone | Low | Missing structure: only useful token-extraction |

Pick the exporter based on the phase. Token extraction wants Dev Mode. Structure wants Anima, Locofy, or a careful HTML export.

## Variable naming: the collision trap

Bricks prefixes its internal variables (`--_bp-*`). Figma exports typically don't prefix. When `convert-html-css-to-bricks-data` generates CSS referencing `var(--spacing-4)`, Bricks doesn't know what that is.

**Before phase 3**, run `list-global-variables` and confirm every token referenced in the Figma HTML/CSS exists in Bricks. If names mismatch:
1. Bulk-rename Figma variables to Bricks' scheme, or
2. Create Bricks globals with the Figma-side names.

Pick one: mixing is pain.

## Testing the loop

- Each phase produces visible output (colors in palette, vars in global-vars panel, components in library, pages in admin).
- Phase 4 screenshot is the final canary. If it matches within ~5px on primary axes, ship. If not, iterate on the specific element, not the full page.

## Never do

- Dump a 20-frame Figma file to `convert-html-css-to-bricks-data` as one giant blob. Abilities have size limits and the output tree is unmaintainable.
- Skip token extraction and let `convert-html-css-to-bricks-data` produce raw hex values everywhere. You'll spend the rest of the project find-replacing colors.
- Build components after pages. You'll duplicate structure 10x and have to extract-and-reference later.
- Trust the first screenshot. Iterate until it matches Figma, or mark deltas as intentional.
- Use Figma auto-layout gap values directly: they often include half-pixel rounding; Bricks' global variables should be integer px.

## Related skills

- `bricks-html-css-to-bricks`: `convert-html-css-to-bricks-data` specifics, class-collision handling.
- `bricks-browser-verify`: screenshot + iterate loop.
- `bricks-design-systems`: how Bricks organizes colors / variables / theme styles.
- `bricks-seed-design-system`: scaffold the token set before porting content.
- `bricks-components`: component authoring deep-dive.
