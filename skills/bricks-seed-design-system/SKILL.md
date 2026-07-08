---
name: bricks-seed-design-system
description: "Use when get-design-context returns empty or near-empty and the user wants a full design system seeded on a greenfield Bricks install. Prescriptive flow: palette + shades, spacing scale, typography scale, root theme style, base classes: in the right order."
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

# Bricks: seed a design system from scratch

Use this skill when `bricks/get-design-context` returns an empty or near-empty editable system and the user wants a real foundation before any page authoring. Fresh Bricks installs can have no saved theme style, custom scale, classes, or components. Bricks still exposes a built-in default color palette fallback, so do not claim there is no default palette. Set the editable tokens first.

> **If a `bricks/*` ability is not available as a direct tool**: first check whether it is outside the fast path and call it through `mcp-adapter-execute-ability` with `ability_name: "bricks/<name>"`. If the dispatcher also rejects it, call `bricks-list-ability-status` to check whether a site admin disabled it under Bricks > AI.

## Order of operations

There is a correct order because later tokens reference earlier ones:

1. **Color palette**: `create-color-palette` (named container).
2. **Base hues into the palette**: `create-color` for each brand/neutral base.
3. **Color shades for each base**: `generate-color-shades` light + dark (+ transparent if needed).
4. **Spacing scale** as fluid variables: `generate-scale-variables`.
5. **Typography scale** as fluid variables: `generate-scale-variables` again (same ability, different category).
6. **Root theme style** referencing the new tokens: `create-theme-style` with `conditions: [{ main: "any" }]` (NOT `entireWebsite`).
7. **Base global classes**: `button`, `card`, `container`, `stack`: referencing the new variables.
8. **Core components**: header, footer, hero. Defer until pages are being authored; don't pre-build.

## Step 1: agree on naming with the user

Before writing anything, confirm:

- **Scale naming:** t-shirt (`2xs`, `xs`, `s`, `m`, `l`, `xl`, `2xl`) or numeric. Pick one and use it for both spacing and typography: do not mix.
- **Color base names:** `brand-primary`, `brand-secondary`, `neutral`, `success`, `warning`, `danger` is a common set. Confirm the brand has a second accent color or if one primary is enough.
- **Shade count and direction:** default to 4 steps light + 4 steps dark per base color. Ask if the brand needs more nuance (5-6) or less (2-3).

Confirm with the user, then start writing.

## Step 2: create the palette container

```
create-color-palette (name: "Brand")
-> returns paletteId
```

Capture the returned `id`. Every subsequent `create-color` and `generate-color-shades` call uses this `paletteId`.

## Step 3: seed the base colors

The `create-color` ability accepts: `paletteId`, `light` (required), `dark` (optional), `raw` (optional CSS variable reference like `var(--brand-primary)`), `parent`, `type`. There is **no** `name` field on individual colors: colors are identified by their CSS variable name (`raw`) and shown in the picker by value.

```
create-color (paletteId, light: "#2B6CB0", raw: "var(--brand-primary)")
create-color (paletteId, light: "#ED64A6", raw: "var(--brand-secondary)")
create-color (paletteId, light: "#1A202C", raw: "var(--neutral-900)")
create-color (paletteId, light: "#F7FAFC", raw: "var(--neutral-100)")
# ... etc for each base
```

The `raw` value matters: the shade generator emits `var(--{baseName}-{l|d|t}-{n})` derived from the variable name in `raw`. If you skip `raw` or `baseVariable`, generated shades keep the same raw base value instead of creating predictable CSS variable references.

## Step 4: generate shades for each base

For each base color (skip pure neutrals if you're using explicit `neutral-100` through `neutral-900`):

```
generate-color-shades (paletteId, colorId, shadeType: "light", steps: 4, save: true)
generate-color-shades (paletteId, colorId, shadeType: "dark", steps: 4, save: true)
```

Param names are exact: `shadeType` (NOT `type`) and `steps` (NOT `count`). Both are required.

Result: a ramp like `brand-primary-l-1..l-4` (lighter than base) and `brand-primary-d-1..d-4` (darker).

Transparent shades are opt-in: use them when you need translucent overlays (e.g. backdrop scrims). Format is `brand-primary-t-1..t-N` with decreasing alpha.

## Step 5: generate the spacing scale

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

Review with the user. Adjust the min/max ratios until the scale feels right. `save: true` requires an existing saved category id; otherwise use the returned variables with `set-global-variables`. Do not create static `space-*` variables by hand.

## Step 6: generate the typography scale

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

**Gotcha:** the generator resolves `html` base font-size from style manager -> theme styles -> `10px` default. If the theme style hasn't been created yet, a `1rem` in your scale resolves to `10px`, not `16px`. Either:
- Set the typography scale after creating the root theme style, or
- Use `px` units in the scale to sidestep the ambiguity.

Do not create static `text-*`, `fs-*`, or matching typography-prefix variables by hand when the category has a scale config.

## Step 7: create the root theme style

```
create-theme-style (
  label: "Root",
  conditions: [{ main: "any" }],
  settings: {
    typography: {
      typographyHtml: "62.5%",
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

## Step 8: seed base classes

After tokens are in place, create the minimum viable class library:

- `.container`: max-width + horizontal padding using `--space-*`.
- `.stack`: vertical rhythm using `--space-*` gap.
- `.cluster`: horizontal wrap using `--space-*` gap.
- `.button`: padding, background `var(--brand-primary)`, hover `var(--brand-primary-d-1)`.
- `.card`: padding, background, border-radius, subtle shadow.

Don't pre-create modifier classes (`.button-lg`, `.button-danger`). Add them when pages actually need them: the design system should be **minimum viable**, not exhaustive.

## Verification (verify-after-write)

After each write, read back to confirm the change actually persisted:

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
- `set-global-variables` (replace) / individual `*-global-variable` ops: variable CRUD.
- `generate-scale-variables`: fluid scale generator.
- `list-theme-styles`, `get-theme-styles`, `create-theme-style`, `update-theme-style`: theme style CRUD.
- `list-global-classes`, `create-global-class`, `update-global-class`: class CRUD.
