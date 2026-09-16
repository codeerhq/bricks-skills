---
name: bricks-figma-to-bricks
description: "Build or update Bricks content from a Figma frame, specification or token export. Preserve existing pages and shared resources when adding a section."
---

# Bricks: Figma to native editable content

Use the selected frame/specification and available Figma access. A missing
integration blocks only source information unavailable by other means; a complete
supplied specification can be enough. Load companions only for an actual subproblem
such as slots, font upload or form actions.

## Choose the target workflow before writing

| Target | Preferred path |
|---|---|
| Known empty page/template body; static source needs no tree surgery | `commit-html-css-page-import` can be the first Bricks operation; submit page content without site header/footer or redundant `main`; inspect omissions/completion |
| Existing page; add a section | Read target tree and relevant design resources; build only the new subtree; `add-element` at the requested parent/sibling position |
| Existing page; change identified elements | Focused partial updates, preserving unrelated settings, children, interactions and references |
| Authorized whole-page rebuild or component/stateful tree assembly | Convert/assemble in memory; persist the complete intended tree with applicable stale-state safeguards |
| New site/design system | Establish the agreed foundation; **bricks-design-systems** or **bricks-seed-design-system** when that scope applies |

Resolve the supplied target or use `find-post`. Create a page only when the brief
calls for one; failed lookup does not authorize a substitute. `set-page-elements`
replaces every element. Keep a complete baseline whenever replacing an existing tree.

## Reuse and map design resources

For existing-site work read relevant design context and actual breakpoint keys,
widths and direction. Summaries help select resources; read exact records where
values, bindings or ownership matter. Reuse appropriate classes, palette colors,
variables, theme styles and components before creating equivalents.

- Preserve exact values, including fractional spacing such as 7.5px. Reuse a token
  only when its meaning and resolved value fit.
- Keep section-specific differences local unless a reusable resource is justified.
  Do not redefine a shared token to repair one section.
- Match the site's naming convention; translate incoming references rather than
  renaming the site's variables to fit an export.
- Establish typography, font availability, rem basis, image crop and responsive
  behavior. Figma text-style names do not determine HTML heading semantics.
- Evaluate the actual export. CSS alone does not establish structure/interactions;
  no exporter is universally the most faithful.

### Missing resources and theme defaults

Palette/color creates use the latest `list-color-palettes` resource `ownership`;
updates use target `itemOwnership`. `create-color` takes `paletteId` and values such
as `light`, not a `hex`/name pair. A palette color with `raw: "var(--name)"` emits
that variable: do not duplicate it as a global variable.

Variables/categories use paired ownership from one fresh `list-global-variables`
read. Category fields are IDs. `generate-scale-variables` previews; persist reviewed
rows through `set-global-variables`, not `save: true`. Use **bricks-design-systems**
for category changes and shared-resource details.

Create/update root defaults only for a foundation or requested site-wide change.
An active root theme style uses `conditions: [{ main: "any" }]`; empty conditions
are inactive. A section insertion does not require a new root theme style or scale.

## Convert and assemble

Use read-only `convert-html-css-to-bricks-data` when the empty-page importer does
not fit. Convert the relevant fragment; inspect warnings, fallback elements and
capability omissions before persistence. Read [the HTML/CSS guide](../bricks-html-css-to-bricks/references/full-guide.md)
for resource reconciliation and conversion mechanics.

Preserve IDs for new accepted converter resources. When reusing an equivalent or
resolving a collision, deliberately map every affected reference. Do not persist
duplicate names or indiscriminately regenerate IDs.

Reuse components when they fit. Create one when repetition or exposed properties
justify it, not automatically for every card/button. Persist its dependencies and
use returned component IDs/remapped bindings for instances. Assemble the final tree
in memory instead of saving a temporary duplicated version.

Static conversion does not establish native Tabs, Accordion, Slider, navigation,
popup triggers, interactions or form actions. Read their runtime schemas and the
relevant companion only when needed. Offcanvas is an element; a popup uses a
template. Do not substitute inert visual imitations for these behaviors.

### Existing-page insertion

Identify the anchor's actual ID, parent and sibling position. Resolve ambiguity
before the dependent write. `add-element` accepts a nested `element` subtree,
`parentId` (`"0"` for root) and zero-based `position` among siblings. Insert after
the observed anchor and preserve old siblings/order. Bricks can generate omitted
internal IDs for nested input.

Inspect returned IDs and perform a focused read when saved settings/structure are
not established by the response. If insertion cannot be expressed through available
operations, use a supported workspace path or merge into a complete fresh baseline
before replacement. Never send only the new section to `set-page-elements`.

## Completion evidence

Check the intended subtree/position, resource mappings and preserved old content.
Inspect import completion and omissions; incomplete content is not a faithful build.
When browser access exists compare the source viewport and relevant site breakpoints,
then test native interactions. Use **bricks-browser-verify** for this work. No fixed
pixel tolerance proves success. Repair within the brief and explain intentional
deviations. Without a browser, perform available data/render checks and report
visual/interactive verification as outstanding.
