---
name: bricks-seed-design-system
description: "Use when get-design-context returns empty or near-empty and the user wants a full design system seeded on a greenfield Bricks install. Prescriptive flow: palette and shades, root font-size basis, spacing and typography scales, completed root theme style, and base classes in dependency order."
---

**Requires:** Bricks 2.4+ with the Abilities API enabled

# Bricks: seed a design system from scratch

Use this skill when `bricks/get-design-context` returns an empty or near-empty editable system and the user wants a real foundation before any page authoring. Fresh Bricks installs can have no saved theme style, custom scale, classes, or components. Bricks still exposes a built-in default color palette fallback, so do not claim there is no default palette. Set the editable tokens first.

When `bricks-commit-site-foundation` is available and the brief also includes a homepage and global header/footer, use that compound greenfield route instead of executing this manual sequence. This skill remains the fallback for a design-system-only task, partial systems, or older ability surfaces.

> **If a `bricks/*` ability is not available as a direct tool**: first check whether it is outside the fast path and call it through `mcp-adapter-execute-ability` with `ability_name: "bricks/<name>"`. If the dispatcher also rejects it, call `bricks-list-ability-status` to check whether a site admin disabled it under Bricks > AI.

## Order of operations

There is a correct order because later tokens reference earlier ones:

1. **Naming agreement** for colors and scales.
2. **Color palette**: `create-color-palette` (named container).
3. **Base hues into the palette**: `create-color` for each brand/neutral base.
4. **Color shades for each base**: `generate-color-shades` light + dark (+ transparent if needed).
5. **Root font-size basis**: create the minimal root theme style before generating either scale.
6. **Spacing scale** as fluid variables: `generate-scale-variables`.
7. **Typography scale** as fluid variables: `generate-scale-variables` again (same ability, different category).
8. **Complete the root theme style** so it references the persisted tokens.
9. **Base global classes**: `button`, `card`, `container`, `stack`: referencing the new variables.
10. **Site templates**: create header/footer templates when the brief includes a homepage or whole-site identity. Their roots must not repeat the automatic semantic landmarks.
11. **Components**: extract genuinely repeated authored structures such as cards or hero patterns after their real content exists; do not pre-build speculative components.

## Step 1: agree on naming with the user

Choose deliberately:

- **Scale naming:** t-shirt (`2xs`, `xs`, `s`, `m`, `l`, `xl`, `2xl`) or numeric. Pick one and use it for both spacing and typography: do not mix.
- **Color base names:** `brand-primary`, `brand-secondary`, `neutral`, `success`, `warning`, `danger` is a common set. Confirm the brand has a second accent color or if one primary is enough.
- **Shade count and direction:** default to 4 steps light + 4 steps dark per base color. Ask if the brand needs more nuance (5-6) or less (2-3).

When the user delegated the design direction or asked for autonomous implementation, choose coherent defaults and continue without a confirmation round trip. Ask only when the naming or scale choice would conflict with supplied brand requirements or materially change an existing system.

## Step 2: create the palette container

```
list-color-palettes -> capture ownership
create-color-palette (name: "Brand", expectedOwnership: ownership)
-> returns palette.id and new ownership
```

Capture the returned `palette.id` and `ownership`. Every subsequent palette/color write
uses this `paletteId` and the latest returned resource ownership.

## Step 3: seed the base colors

The `create-color` ability accepts: `paletteId`, `light` (required), `dark` (optional), `raw` (optional CSS variable reference like `var(--brand-primary)`), `parent`, `type`. There is **no** `name` field on individual colors: colors are identified by their CSS variable name (`raw`) and shown in the picker by value.

```
create-color (paletteId, light: "#2B6CB0", raw: "var(--brand-primary)", expectedOwnership: latestOwnership)
create-color (paletteId, light: "#ED64A6", raw: "var(--brand-secondary)", expectedOwnership: latestOwnership)
create-color (paletteId, light: "#1A202C", raw: "var(--neutral-900)", expectedOwnership: latestOwnership)
create-color (paletteId, light: "#F7FAFC", raw: "var(--neutral-100)", expectedOwnership: latestOwnership)
# ... etc for each base
```

After every call, replace `latestOwnership` with that response's `ownership`.
Do not fan these writes out in parallel: each append changes the palette graph.

The `raw` value matters: the shade generator emits `var(--{baseName}-{l|d|t}-{n})` derived from the variable name in `raw`. If you skip `raw` or `baseVariable`, generated shades keep the same raw base value instead of creating predictable CSS variable references.

## Step 4: generate shades for each base

For each base color (skip pure neutrals if you're using explicit `neutral-100` through `neutral-900`):

```
lightPreview = generate-color-shades (paletteId, colorId, shadeType: "light", steps: 4, save: false)
generate-color-shades (paletteId, colorId, shadeType: "light", steps: 4, save: true, expectedOwnership: lightPreview.saveOwnership)
darkPreview = generate-color-shades (paletteId, colorId, shadeType: "dark", steps: 4, save: false)
generate-color-shades (paletteId, colorId, shadeType: "dark", steps: 4, save: true, expectedOwnership: darkPreview.saveOwnership)
```

Param names are exact: `shadeType` (NOT `type`) and `steps` (NOT `count`). Both are required.

Result: a ramp like `brand-primary-l-1..l-4` (lighter than base) and `brand-primary-d-1..d-4` (darker).

Transparent shades are opt-in: use them when you need translucent overlays (e.g. backdrop scrims). Format is `brand-primary-t-1..t-N` with decreasing alpha.

## Step 5: establish the root font-size basis

Both spacing and typography scale generation resolve rem values against the current
HTML font size. Determine the intended root size from the brief or existing site and
default to `100%` when neither specifies one. Create a minimal root theme style before
either scale and capture its ID. Set `<root-font-size>` below to that value and use
the same basis for both scales.

```
create-theme-style (
  label: "Root",
  conditions: [{ main: "any" }],
  settings: { typography: { typographyHtml: "<root-font-size>" } }
)
```

Re-read the theme style and design context before continuing.

## Step 6: generate the spacing scale

```
generate-scale-variables({
  category: {
    id: "preview-space",
    name: "Spacing",
    scale: {
      scaleScope: "spacing",
      scaleType: "tshirt",
      scaleNames: ["2xs", "xs", "s", "m", "l", "xl", "2xl", "3xl"],
      prefix: "space-",
      minFontSize: 16,
      minScaleRatio: 1.25,
      minScaleRatioSelect: 1.25,
      maxFontSize: 20,
      maxScaleRatio: 1.333,
      maxScaleRatioSelect: 1.333,
      baseline: "m"
    }
  },
  scaleRange: { from: -3, to: 4 },
  save: false
})
```

Output names use Bricks t-shirt steps: `--space-2xs`, `--space-xs`, `--space-s`, `--space-m` (baseline), `--space-l`, `--space-xl`, `--space-2xl`, `--space-3xl`.

**`scaleNames` must list exactly the steps `scaleRange` produces, in order** — eight names here for `from: -3, to: 4`. The builder generates one variable per `scaleNames` entry, and `regenerateVariables()` reads a variable's step from its index in that list. A short or misaligned list silently rewrites every value at the wrong step the next time the html font size or screen widths change.

Review with the user and adjust the ratios. `generate-scale-variables` rejects
`save: true`; preview with `save: false`, then persist the returned rows as described
below. First create or update the complete category list with
`set-global-variable-categories`, passing the
latest `categoryOwnership` as `expectedOwnership` and the same read's
`variableOwnership` as `expectedVariableOwnership`. Then preview by saved
`categoryId` and persist the returned generated rows through `set-global-variables`
with fresh `expectedVariableOwnership` and `expectedCategoryOwnership`. Preserve all
existing categories in the category replacement. Do not hand-author static
`space-*` variables.

## Step 7: generate the typography scale

**Same ability**, different category. Typography reuses the exact spacing-scale generator; there is no separate typography tool.

```
generate-scale-variables({
  category: {
    id: "preview-text",
    name: "Typography",
    scale: {
      scaleScope: "typography",
      scaleType: "tshirt",
      scaleNames: ["xs", "s", "m", "l", "xl", "2xl", "3xl", "4xl"],
      prefix: "text-",
      minFontSize: 16,
      minScaleRatio: 1.2,
      minScaleRatioSelect: 1.2,
      maxFontSize: 20,
      maxScaleRatio: 1.333,
      maxScaleRatioSelect: 1.333,
      baseline: "m"
    }
  },
  scaleRange: { from: -2, to: 5 },
  save: false
})
```

Output names use the same t-shirt naming model: `--text-xs`, `--text-s`, `--text-m`, `--text-l`, `--text-xl`, `--text-2xl`, `--text-3xl`, `--text-4xl`.

The generator uses the same root basis established in Step 5. If that basis changed,
stop and regenerate both spacing and typography scales from a fresh read.

Do not create static `text-*`, `fs-*`, or matching typography-prefix variables by hand when the category has a scale config.

As with spacing, `generate-scale-variables` is preview-only. Persist its exact rows
through ownership-guarded `set-global-variables`; do not retry `save: true`.

## Step 8: complete the root theme style

```
update-theme-style (
  id: <root-theme-style-id>,
  expectedOwnership: <fresh root theme-style itemOwnership>,
  conditions: [{ main: "any" }],
  settings: {
    typography: {
      typographyHtml: "<root-font-size>",
      typographyBody: {
        "font-family": "...",
        "color": "var(--neutral-900)",
        "font-size": "var(--text-m)"
      },
      typographyHeadings: {
        "font-family": "...",
        "color": "var(--neutral-900)"
      },
      typographyHeadingH1: { "font-size": "var(--text-4xl)" },
      typographyHeadingH2: { "font-size": "var(--text-3xl)" }
    }
  }
)
```

**Critical:** `conditions: [{ main: "any" }]`. Use `any`, not `entireWebsite`. A theme style with no conditions is silently ignored.

If the user wants per-CPT overrides later, create a second theme style with `conditions: [{ main: "postType", postType: ["product"] }]`. By default, Bricks uses the highest-scoring matching theme style, so this post-type style beats the broader `any` style on product pages.

## Step 9: seed base classes

After tokens are in place, create the minimum viable class library:

- `.container`: max-width + horizontal padding using `--space-*`.
- `.stack`: vertical rhythm using `--space-*` gap.
- `.cluster`: horizontal wrap using `--space-*` gap.
- `.button`: padding, background `var(--brand-primary)`, hover `var(--brand-primary-d-1)`.
- `.card`: padding, background, border-radius, subtle shadow.

Don't pre-create modifier classes (`.button-lg`, `.button-danger`). Add them when pages actually need them: the design system should be **minimum viable**, not exhaustive.

## Verification

Use authoritative mutation readback when it contains the complete affected resource.
Otherwise run the matching read below. Render only the representative token behavior
needed to prove the system, not a sandbox element after every individual write:

1. After palette/colors/shades: `list-color-palettes` (filter to the new paletteId).
2. After scales: `list-global-variables`: confirm category present and step count matches.
3. After theme style: `get-theme-styles` with the returned id: confirm `conditions` and `settings` round-trip.
4. For the scale, render a div with `style: { padding: var(--space-m) }` via `update-element` on a sandbox post and inspect the computed CSS for a `clamp()`.
5. For the palette, render an element with `background: var(--brand-primary)`: confirm the emitted CSS references the variable, not a hardcoded hex.

If the read doesn't match what you wrote, **stop** and surface the discrepancy to the user: don't keep building on a broken foundation.

## When the user already has a partial system

Use this only for **fully fresh** installs. If `get-design-context` returns partial state (e.g. two colors and a half-built scale), do not wipe and re-seed. Instead:

- Find the missing slots (see **bricks-design-systems** skill's "empty slots" rule).
- Fill them with names matching the existing convention.
- If the existing system is genuinely broken (inconsistent naming, fragmented palettes), propose a cleanup plan to the user first: never silently restructure.

## Related abilities

- `create-color-palette`, `update-color-palette` (rename), `delete-color-palette`: palette CRUD.
- `create-color`, `update-color`, `delete-color`: single color CRUD.
- `generate-color-shades`: auto-derive light/dark/transparent ramps.
- `set-global-variables` (ownership-guarded upsert) and
  `delete-global-variable`: variable CRUD; category replacement is separate.
- `generate-scale-variables`: fluid scale generator.
- `list-theme-styles`, `get-theme-styles`, `create-theme-style`, `update-theme-style`: theme style CRUD.
- `list-global-classes`, `create-global-class`, `update-global-class`: class CRUD.
