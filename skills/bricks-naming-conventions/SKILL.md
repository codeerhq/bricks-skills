---
name: bricks-naming-conventions
description: "Choose names before creating or renaming Bricks shared classes, variables, components or templates; match the site’s existing convention."
---

# Bricks: naming conventions

Follow user-specified names and the site’s existing naming convention.

> **If a `bricks/*` ability is not available as a direct tool**: first check whether it is outside the fast path and call it through `mcp-adapter-execute-ability` with `ability_name: "bricks/<name>"`. If the dispatcher also rejects it, call `bricks-list-ability-status` to check whether a site admin disabled it under Bricks > AI.

## Detection

Call `bricks/get-design-context`. Scan the returned names for:

**Global classes**
- Case: `lowercase` / `kebab-case` / `PascalCase` / `camelCase`. Most Bricks sites use kebab-case.
- Prefix convention: `is-*`, `has-*`, `u-*` (utilities), `c-*` (components), no prefix at all.
- Modifier separator: `.button--primary` (BEM) / `.button-primary` (flat) / `.button.primary` (class combos: Bricks supports these natively).

**Global variables**
- Hyphen convention: `--space-md` vs `--spacing-md` vs `--spacer-4`.
- Scale naming: t-shirt (`xs sm md lg xl`), numeric (`1 2 3 4 5 6`), custom.
- Baseline: `md` (t-shirt), `4` (numeric), something else.
- Color naming: `--color-primary-500`, `--brand-primary`, `--c-primary`. All valid; pick the one already on the site.

**Components**
- Title case (`Hero Section`) vs kebab-case (`hero-section`) vs space-separated lowercase (`hero section`).
- Property naming: `label` vs `title` vs `heading`. Inside the component, property ids usually match the builder's auto-generated pattern.

**Templates**
- `Header`, `Footer`, `Single Post`, `Archive: Products`. Em-dash or hyphen? Capitalization? Match what exists.

## Rules

1. **Follow the existing convention by default.** If the user explicitly specifies an exact name such as `BrandHero`, preserve it. Flag consequential naming conflicts.

2. **Preserve existing names.** When conventions are mixed, follow the relevant resource group. Ask when the choice affects shared resources.

3. **One pattern, one scale.** If a t-shirt spacing scale already exists, don't add a numeric one alongside. Extend the t-shirt scale (`2xs`, `3xl`) if needed.

4. **Use readable component labels**, such as `Hero: Dark Variant`, unless the user supplied an exact name.

5. **Read nearby resource names** when the convention is unclear.

## Red flags

- Resolve conflicting case or prefix conventions before extending shared resources.
- Adding `--color-*` variables to a site that already uses `--brand-*`: use the existing prefix.
- Creating a `.btn` class on a site that already has `.button`: that's the same resource spelled differently; reuse, don't add.
