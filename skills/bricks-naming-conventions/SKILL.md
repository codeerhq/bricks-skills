---
name: bricks-naming-conventions
description: "Use before creating or renaming any global class, variable, component, or template. Detect the site's existing naming convention and match it: never fragment by creating a parallel one."
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

# Bricks: naming conventions

Every Bricks site settles into naming patterns. Detect them before you write, and **match them**: don't impose generic defaults.

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

1. **Never create a parallel convention.** If all classes are kebab-case and you're asked to create `BrandHero`, convert to `brand-hero` (or `hero-brand` if the site uses a component-prefix).

2. **Flag the inconsistency, don't silently fix it.** If you detect mixed conventions (half kebab-case, half camelCase), say so and ask the user which should win: don't unilaterally rename existing tokens.

3. **One pattern, one scale.** If a t-shirt spacing scale already exists, don't add a numeric one alongside. Extend the t-shirt scale (`2xs`, `3xl`) if needed.

4. **Component labels are human-facing.** The builder's component panel shows the label. Keep it readable: `Hero: Dark Variant`, not `hero_dark_v2`.

5. **When in doubt, read a few existing names and mirror the pattern.** Confidence in detection > imposing a "correct" convention.

## Red flags

- Before creating 3+ new classes with different case/prefix conventions: stop, ask which pattern to follow.
- Adding `--color-*` variables to a site that already uses `--brand-*`: use the existing prefix.
- Creating a `.btn` class on a site that already has `.button`: that's the same resource spelled differently; reuse, don't add.
