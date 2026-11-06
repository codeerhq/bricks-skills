---
name: bricks-design-systems
description: "Change fonts, typography, colors or spacing across a Bricks site, or author global classes, variables, palettes and theme styles. Choose native style ownership while preserving existing conventions; skip isolated element-only edits."
---

# Bricks: design system authoring

> **If a `bricks/*` ability is not available as a direct tool**: first check whether it is outside the fast path and call it through `mcp-adapter-execute-ability` with `ability_name: "bricks/<name>"`. If the dispatcher also rejects it, call `bricks-list-ability-status` to check whether a site admin disabled it under Bricks > AI.

## Choose where the change belongs

For unpublished changes or independent design alternatives, first use
[bricks-site-versions](../bricks-site-versions/SKILL.md). Its explicit private
context keeps shared edits out of the live site; ordinary global write abilities
below retain their live behavior.

For a build or redesign, decide style ownership before adding resources. Preserve
existing exceptions; a focused edit does not authorize a sitewide cleanup.

- **Theme styles:** applicable sitewide defaults such as body and heading typography.
  Check conditions and inherited values before repeating these in classes. When
  consolidating shared defaults, remove redundant class overrides within the
  requested scope instead of copying the new default into every class. Preserve
  intentional scoped exceptions and unrelated properties.
- **Global classes:** reusable patterns and intentional variations. Use native
  controls for supported styles; use element controls for genuinely local exceptions.
- **Variables and palettes:** shared values with meaningful consumers. Reuse the
  existing scale; do not wrap every literal. Native font selectors are sufficient
  for native typography. Keep font variables only when a custom-code consumer needs them.
- **Custom CSS:** unsupported selectors, effects or behavior. For existing CSS,
  use the conversion workflow in **bricks-html-css-to-bricks** before hand mapping.
  Preserve residual rules, selector groups, responsive states and cascade order.

A saved setting is not proof of effective CSS: check the actual consuming element's
schema and render output. A global class control may not apply to every element type.

These defaults follow [Theme styles](https://academy.bricksbuilder.io/builder/styling/theme-styles/)
and [Global CSS classes](https://academy.bricksbuilder.io/builder/styling/global-css-classes/).

For an existing uploaded font, `list-custom-fonts` returns `items` with family IDs.
Native typography stores the selected family as `custom_font_<id>` in `font-family`.
Applying that font changes theme/class/element controls, not the font family record.
Use `get-custom-font({ fontId })` when face details are needed.

## Before you write anything

Call `bricks/get-design-context`. You are looking for three answers:

1. Does a matching resource already exist? Reuse it.
2. Is there a convention to follow? (kebab-case classes, `--space-{size}` variable naming, t-shirt or numeric scale: match it.)
3. Are there empty slots? (Palette exists but one color is missing, scale exists but one step is missing.) Fill the slot instead of creating a new parallel resource.

Also inspect `variableCategories`. If a category already has a `scale` config, use that category ID and prefix. Do not create `fs-*` variables when the typography category prefix is `text-`, and use the generator for changes to that scale. Exact local values can still be appropriate when the brief requires a value outside the scale; do not redefine the shared scale for one exception.

**A fresh Bricks install can have no saved design-system resources**: no custom theme style, classes, components, or saved variables. Bricks still exposes a built-in default color palette fallback in the builder and in `list-color-palettes`; do not tell users Bricks has no default palette. If it returns empty, create only the resources the task needs. Use **bricks-seed-design-system** when a full foundation is requested, not for every isolated edit.

## Current write preconditions

Global design writes no longer share one coarse version precondition. Immediately
before a focused write, call the matching focused read and pass its complete returned
ownership data unchanged:

- Global classes: single `create-global-class` has no resource ownership parameter;
  pass `expectedCategoryOwnership` only when assigning a category.
  `batch-create-global-classes` requires resource `expectedOwnership` and category
  ownership when categorized. Updates/deletes require the target row's
  `itemOwnership` as `expectedOwnership` plus `lockOwnership`.
- Variables/categories: both `variableOwnership` and `categoryOwnership`; category
  writes replace the complete category list and must preserve opaque fields.
- Palettes/colors: resource `ownership` for creates and target `itemOwnership` for
  updates/deletes. Chain each successful response's new `ownership` into sequential
  palette mutations.
- Theme styles: use the target `itemOwnership` for update/delete. Fetch the specific
  style when editing settings; a summary digest still covers the complete hidden row.
- Components: update/delete still require `expectedDesignSystemVersion` and now also
  the complete current `expectedComponentDigest`.

Deletion acknowledgement flags (`allowOrphans`) are mandatory where documented and
do not replace ownership. On any stale precondition, re-read and rebase; do not
manufacture ownership data from `get-design-context.version`.

## Global classes

- Names must be **unique across all classes**. The write aborts with `bricks_conflict_duplicate_global_class_name` if the name is taken. Read the existing one before retrying.
- Follow existing names and user-specified naming. On a new system without a convention, lowercase kebab-case such as `.button` or `.hero-text` is a useful default.
- Don't create modifier classes like `.button-red`: create a base class and a modifier class that sets only the color. Bricks supports class combinations natively.
- Class settings follow the same shape as element settings: call `bricks/render-elements` on a minimal element using the class to verify CSS output before committing settings programmatically.

## Global variables

For variable/category writes or fluid scales, read [Variable and scale contracts](references/variables.md). Reuse existing categories and scale prefixes; use the generator rather than inventing static replacements for generated scale steps.

## Color palettes

For palette/color changes or generated shades, read [Palette and shade contracts](references/palettes.md). Reuse an existing palette before creating another.

## Theme styles

- **Theme styles do not apply without conditions.** A style with an empty conditions array is ignored by the normal theme-style matcher. Always set `conditions` when creating: use `[{ main: "any" }]` for a site-wide base, or a more specific condition such as `postType`, `ids`, `terms`, or `archiveType`.
- By default, Bricks applies the highest-scoring matching theme style. More specific conditions beat broad ones: `postType` beats `any`, and exact `ids` beats `postType`.
- If the Theme styles loading method setting is enabled, Bricks loads every matching theme style in score order. In that mode, broad styles load earlier and more specific styles load later.
- The first theme style on a fresh site should almost always be `conditions: [{ main: "any" }]` so defaults actually render.
- Theme styles are stored in a global option, not post revisions. Use `delete-theme-style` for cleanup; it returns the removed style in `beforeDelete`.
- Updates and deletes require the target style's current `itemOwnership`. Fetch the
  exact style with `get-theme-styles({ style: id })` before changing settings.
- Deleting a style that has settings or conditions additionally requires
  `acknowledgeStyleRemoval: true` after reviewing the returned bounded impact
  evidence. This acknowledgement belongs to delete, not update.

## Components

- **Labels are unique across all components.** `bricks_conflict_duplicate_component_name` on collision.
- Components carry their own element tree. External references to global classes and CSS variables inside that tree are preserved: if a component uses `.button` and `var(--space-m)`, those references follow it wherever it's instanced.
- **Deleting a component with non-zero `usageCount` leaves orphan pointers.** The builder renders missing components as a placeholder. Either replace the usages first or explicitly accept the orphans with the user.
- Prefer `extract-component-from-elements` over copying element trees. The extraction rewrites ids cleanly and swaps the source subtree to a component instance in one write, with a revision snapshot.

See the **bricks-components** skill for slots, nested components, and property binding specifics.

## Workflows

### Add a color ramp to an existing palette
1. `list-color-palettes`, then `create-color` with its resource ownership and the intended `raw` variable reference.
2. Preview `generate-color-shades` with `save: false`; re-run with `save: true` and the preview's `saveOwnership` as `expectedOwnership`.
3. Repeat for `dark` (and optional `transparent` for tints).
4. `list-color-palettes` to verify.

### Add or replace a scale
1. Pick the naming first (t-shirt or numeric) and stick to it across typography + spacing.
2. `generate-scale-variables` with `save: false`: review output with user.
3. Once approved, pass the returned rows to ownership-guarded `set-global-variables`.
4. `list-global-variables` to verify.

For building a full design system from an empty site, use the **bricks-seed-design-system** skill. For cleanup of an existing one, use **bricks-audit-design-system**.

## Style Manager and state configuration

Use the live `get-style-manager` / `set-style-manager` contract for root font size,
fluid viewport bounds and default mode. The setter replaces the complete option:
read and preserve unrelated keys. Changing the rem basis or scale bounds is a
site-wide decision, not a local spacing fix.

For custom pseudo-class choices, use `list-pseudo-classes` / `set-pseudo-classes`
with current ownership. Preserve existing selectors; removal acknowledgement does
not prove existing styles are unused. Verify hover, focus and responsive states
where the changed resource is consumed. Existing framework naming/scales take
precedence over introducing a parallel scheme.
