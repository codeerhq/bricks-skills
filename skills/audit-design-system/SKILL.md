---
name: audit-design-system
description: "Use when the user asks to review, clean up, or fix their design system specifically: \"review my classes\", \"why are my colors inconsistent\", \"clean up unused classes\", \"audit my design system\". Read-only scan for orphans, unused tokens, dead theme styles, palette fragmentation. Never auto-fixes. For a full site health check, use site-audit instead."
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

# Bricks: audit & clean the design system

Use this skill when the user says things like "review my design system", "clean up unused classes", "why are my colors inconsistent", or "audit my site". The entry point is `bricks/audit-design-system`: read-only, safe to run without approval.

> **If a `bricks/*` ability is not available as a direct tool**: first check whether it is outside the fast path and call it through `mcp-adapter-execute-ability` with `ability_name: "bricks/<name>"`. If the dispatcher also rejects it, call `bricks-list-ability-status` to check whether a site admin disabled it under Bricks > Settings > AI.

## Run the audit

```
bricks/audit-design-system (scope: "all")
```

Scope options:
- `all`: everything (default; may take a few seconds on large sites)
- `orphans`: **errors** only: elements referencing classes/variables/components that no longer exist
- `unused`: resources defined but never referenced anywhere
- `theme-styles`: theme styles with no conditions (silently ignored)
- `palettes`: duplicate `raw` values + palette entries whose `raw` value does not contain a CSS variable reference

For a fast check without scanning posts: `skipPostScan: true` (skips unused + orphans, keeps theme-styles + palettes).

## How to read the output

Every issue has:
- `severity`: `error`, `warning`, or `info`
- `category`: `orphans`, `unused`, `theme-styles`, or `palettes`
- `resourceType` + `resourceId`: what to fix
- `message`: what's wrong
- `suggestion`: recommended action (not auto-applied)

**Present issues grouped by severity, not by category.** Errors block correct rendering; warnings are silently-broken config; infos are cleanup. Users triage that way.

## How to decide what to fix

When any fix requires creating or renaming a design resource, apply the rules from the **design-systems** skill (naming conventions, uniqueness constraints, shade generation).

### Errors (always raise to user, never auto-fix)
- **Orphan class reference**: an element is pointing at a class id that doesn't exist. Either the class was deleted without cleaning up references, or the data was imported broken. Fix path: either recreate the class, or locate and strip the stale id from `_cssGlobalClasses` on affected elements.
- **Orphan variable reference**: CSS text says `var(--foo)` but `--foo` isn't defined anywhere. The rule will fall back to nothing (transparent, inherit, etc.) and render wrong. Fix path: create the variable, or rewrite the reference.
- **Orphan component reference**: `"cid":"..."` points at a component that no longer exists. The builder shows a missing-component placeholder. Fix path: recreate the component with the original id (rare, usually requires a backup) or use `update-element` / `set-page-elements` to remove the stale instance.

### Warnings (raise, usually fix with approval)
- **Theme style with no conditions**: the style is inert in the normal theme-style matcher. Either the user meant to apply it site-wide (`conditions: [{ main: "any" }]`) or they abandoned it mid-config. Ask which.

### Infos (summarize, fix only when user asks)
- **Unused global class**: may be intentional (staging a class for upcoming work). Never auto-delete. Offer a batched delete after confirmation.
- **Unused global variable**: same.
- **Unused component**: same.
- **Palette color without a variable reference in `raw`**: the color can still work, but it is only referenced by its stored value. If the site uses tokenized colors, set `raw` to a CSS variable reference such as `var(--brand-primary)`. Leave literal values alone when that is intentional.
- **Duplicate color across palettes**: the same hex appears N times. Offer to consolidate.

## Fix workflow

Never bulk-fix. Fix one category at a time, with the user's eyes on each change:

1. Show the audit summary: `N errors, M warnings, K infos`.
2. Show the error list in full: these are actually broken.
3. Ask: "Fix errors first, or review the full list?"
4. For each fix:
   - Read the affected resource (`get-page-elements`, `list-global-classes`, etc.).
   - Propose the exact change in plain English + the ability call.
   - Wait for approval.
   - Apply. Capture `revisionId` where applicable.
   - Move to the next.
5. After a round of fixes, re-run the audit to confirm the issues are gone and nothing new surfaced.

## Things the audit misses (and you should mention)

- **Naming inconsistency**: mix of `camelCase` / `kebab-case` / `snake_case` across classes or variables. The audit doesn't flag it because "consistent" is subjective. Scan `list-global-classes` / `list-global-variables` manually if the user asks.
- **Semantic overlap**: `.btn` and `.button` are both used, defining similar styles. The audit can't infer intent. Suggest merging if you see it.
- **Scale gaps**: spacing or typography scale missing middle steps. Read `list-global-variables` and check for numeric/t-shirt continuity.
- **Unused palette entries**: palette colors not referenced by any class, variable, or element setting. The audit doesn't scan for this; add it to the manual pass if the palette is large.

## When not to run this

- Right after a fresh install (`get-design-context` is empty): there's nothing to audit. Use the **seed-design-system** skill instead.
- Mid-edit, when the user is actively working on design tokens: the audit will flag in-progress work as "unused." Wait until a stable point.
