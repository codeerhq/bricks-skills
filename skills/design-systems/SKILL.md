---
name: design-systems
description: "Use when creating or updating design tokens: global classes, variables, color palettes, theme styles, components. Enforces uniqueness, scale-generator usage, and conditions on theme styles. Prevents system fragmentation."
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

# Bricks: design system authoring

> **If a `bricks/*` ability is not available as a direct tool**: first check whether it is outside the fast path and call it through `mcp-adapter-execute-ability` with `ability_name: "bricks/<name>"`. If the dispatcher also rejects it, call `bricks-list-ability-status` to check whether a site admin disabled it under Bricks > Settings > AI.

## Before you write anything

Call `bricks/get-design-context`. You are looking for three answers:

1. Does a matching resource already exist? Reuse it.
2. Is there a convention to follow? (kebab-case classes, `--space-{size}` variable naming, t-shirt or numeric scale: match it.)
3. Are there empty slots? (Palette exists but one color is missing, scale exists but one step is missing.) Fill the slot instead of creating a new parallel resource.

Also inspect `variableCategories`. If a category already has a `scale` config, use that category ID and prefix. Do not create `fs-*` variables when the typography category prefix is `text-`, and do not hand-author static spacing/type values when a scale category exists.

**A fresh Bricks install can have no saved design-system resources**: no custom theme style, classes, components, or saved variables. Bricks still exposes a built-in default color palette fallback in the builder and in `list-color-palettes`; do not tell users Bricks has no default palette. If `get-design-context` returns empty, treat the editable design system as greenfield and seed it deliberately (see **seed-design-system** skill).

## Global classes

- Names must be **unique across all classes**. The write aborts with `bricks_conflict_duplicate_global_class_name` if the name is taken. Read the existing one before retrying.
- Keep names **kebab-case**, lowercase, no vendor prefixes. `.button`, `.card`, `.hero-text`. Not `btn_v2`, `Button`, `--hero-text`.
- Don't create modifier classes like `.button-red`: create a base class and a modifier class that sets only the color. Bricks supports class combinations natively.
- Class settings follow the same shape as element settings: call `bricks/render-elements` on a minimal element using the class to verify CSS output before committing settings programmatically.

## Global variables

- **Use the scale generator** (`bricks/generate-scale-variables`) for typography and spacing. Do not hand-author static spacing or type variables that match a configured scale prefix. The same generator handles **both** typography and spacing: it's one math model (fluid `clamp()` with slope) driven by the category config. There is no separate typography-scale tool.
- When `get-design-context.variableCategories` includes spacing or typography categories with `scale`, pass the existing `categoryId` to `generate-scale-variables`. The generated names inherit the configured prefix, such as `space-` or `text-`.
- The scale generator resolves the html base font-size from three sources in order: **style manager value -> theme styles -> `10px` default**. If your scale outputs unexpected pixel values, that order is why.
- Variable names must be unique **at save time**, but **the builder UI does not validate this on create**: call `list-global-variables` first and guard against duplicates before writing. Conflict returns `bricks_conflict_duplicate_global_variable_name` on save.
- Variables are referenced in CSS as `var(--{name})`. Use the bare name (`space-m`, not `--space-m`) when creating: Bricks adds the `--` prefix when emitting CSS.
- When building a fluid scale, use the Bricks scale shape: `category.scale` with keys like `scaleScope`, `scaleType`, `scaleNames`, `prefix`, `minFontSize`, `minScaleRatio`, `maxFontSize`, `maxScaleRatio`, and `baseline`. The default t-shirt baseline is `m`, with names like `2xs`, `xs`, `s`, `m`, `l`, `xl`, `2xl`.
- `generate-scale-variables` with `save: false` returns the generated variables for review; show these to the user and wait for approval before saving.
- Global variables are stored in a global option, not post revisions. Use `delete-global-variable` for cleanup of individual variables; it returns a `beforeDelete` snapshot.

## Color palettes

- Palettes are ordered arrays of colors. Each color has an id, name, raw value (hex / rgb / rgba / hsl / hsla accepted), and optional CSS variable reference.
- **Formats usually round-trip.** Light and dark shades preserve the parsed base format. Transparent shades are emitted as HSL/HSLA because the builder's transparent-shade path changes alpha directly.
- Before creating a new palette, check whether the existing primary palette has the color. Fragmented palettes are the most common design-system mess.
- **Generating shades.** Use `bricks/generate-color-shades` to produce light, dark, or transparent ramps from a base color. The ability uses Bricks' PHP color helper, ported from the builder Color Shades popup, so previews should match the builder math. Shade `raw` names become `var(--{base-variable}-{l|d|t}-{index})` only when the base color has a `raw` value such as `var(--brand-primary)` or when `baseVariable` is passed. Without that variable reference, each generated shade keeps the base raw value. When `save: true`, existing shades of the same type, parent, and mode are replaced.
- A color ramp is two-step: create the base color with a `var(--name)` reference, then call `generate-color-shades` for `light` and `dark` (typically 4-5 steps each). `transparent` is optional for tint overlays.

## Theme styles

- **Theme styles do not apply without conditions.** A style with an empty conditions array is ignored by the normal theme-style matcher. Always set `conditions` when creating: use `[{ main: "any" }]` for a site-wide base, or a more specific condition such as `postType`, `ids`, `terms`, or `archiveType`.
- By default, Bricks applies the highest-scoring matching theme style. More specific conditions beat broad ones: `postType` beats `any`, and exact `ids` beats `postType`.
- If the Theme styles loading method setting is enabled, Bricks loads every matching theme style in score order. In that mode, broad styles load earlier and more specific styles load later.
- The first theme style on a fresh site should almost always be `conditions: [{ main: "any" }]` so defaults actually render.
- Theme styles are stored in a global option, not post revisions. Use `delete-theme-style` for cleanup; it returns the removed style in `beforeDelete`.

## Components

- **Labels are unique across all components.** `bricks_conflict_duplicate_component_name` on collision.
- Components carry their own element tree. External references to global classes and CSS variables inside that tree are preserved: if a component uses `.button` and `var(--space-m)`, those references follow it wherever it's instanced.
- **Deleting a component with non-zero `usageCount` leaves orphan pointers.** The builder renders missing components as a placeholder. Either replace the usages first or explicitly accept the orphans with the user.
- Prefer `extract-component-from-elements` over copying element trees. The extraction rewrites ids cleanly and swaps the source subtree to a component instance in one write, with a revision snapshot.

See the **components** skill for slots, nested components, and property binding specifics.

## Workflows

### Add a color ramp to an existing palette
1. `create-color` with `raw: "#RRGGBB"` + `variable: "brand-primary"`.
2. `generate-color-shades` with `paletteId`, `colorId`, `shadeType: "light"`, `steps: 4`, `save: true`.
3. Repeat for `dark` (and optional `transparent` for tints).
4. `list-color-palettes` to verify.

### Add or replace a scale
1. Pick the naming first (t-shirt or numeric) and stick to it across typography + spacing.
2. `generate-scale-variables` with `save: false`: review output with user.
3. Re-run with `save: true` once approved.
4. `list-global-variables` to verify.

For building a full design system from an empty site, use the **seed-design-system** skill. For cleanup of an existing one, use **audit-design-system**.
