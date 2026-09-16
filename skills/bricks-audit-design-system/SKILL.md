---
name: bricks-audit-design-system
description: "Audit Bricks classes, variables, palettes and components, or carry out requested cleanup. Report-only audits do not authorize fixes."
---

# Bricks: audit & clean the design system

Use this skill when the user says things like "review my design system", "clean up unused classes", "why are my colors inconsistent", or "audit my design tokens". For a generic whole-site audit, use **bricks-site-audit** instead. The entry point here is `bricks/audit-design-system`: read-only, safe to run without approval.

> **If a `bricks/*` ability is not available as a direct tool**: first check whether it is outside the fast path and call it through `mcp-adapter-execute-ability` with `ability_name: "bricks/<name>"`. If the dispatcher also rejects it, call `bricks-list-ability-status` to check whether a site admin disabled it under Bricks > AI.

## Run the audit

```
bricks/audit-design-system (scope: "all")
```

Scope options:
- `all`: everything (default; may take a few seconds on large sites)
- `orphans`: **errors** only: elements referencing classes/variables/components that no longer exist
- `unused`: resources with no references found in the scan; check coverage before calling them unused
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

**Present issues grouped by severity.** Explain rendering errors first, then configuration warnings and cleanup suggestions.

## How to decide what to fix

When any fix requires creating or renaming a design resource, apply the rules from the **bricks-design-systems** skill (naming conventions, uniqueness constraints, shade generation).

### Errors (report; repair when within the requested scope)
- **Orphan class reference**: an element is pointing at a class id that doesn't exist. Either the class was deleted without cleaning up references, or the data was imported broken. Fix path: either recreate the class, or locate and strip the stale id from `_cssGlobalClasses` on affected elements.
- **Orphan variable reference**: CSS text says `var(--foo)` but `--foo` isn't defined anywhere. The rule will fall back to nothing (transparent, inherit, etc.) and render wrong. Fix path: create the variable, or rewrite the reference.
- **Orphan component reference**: `"cid":"..."` points at a component that no longer exists. The builder shows a missing-component placeholder. Fix path: recreate the component with the original id (rare, usually requires a backup) or use `update-element` / `set-page-elements` to remove the stale instance.

### Warnings (determine whether configuration is intentional)
- **Theme style with no conditions**: the style is inert in the normal theme-style matcher. Either the user meant to apply it site-wide (`conditions: [{ main: "any" }]`) or they abandoned it mid-config. Ask which.

### Infos (summarize, fix only when user asks)
- **Unused global class**: may be intentional (staging a class for upcoming work). Do not delete solely from this finding. Review reference coverage and the requested cleanup scope.
- **Unused global variable**: same.
- **Unused component**: same.
- **Palette color without a variable reference in `raw`**: the color can still work, but it is only referenced by its stored value. If the site uses tokenized colors, set `raw` to a CSS variable reference such as `var(--brand-primary)`. Leave literal values alone when that is intentional.
- **Duplicate color across palettes**: the same hex appears N times. Offer to consolidate.

## Fix workflow

For a review request, report findings and proposed repairs without mutating. For
an authorized cleanup/fix request, apply a coherent batch within that scope; do not
ask for approval again for every item. Clarify only unresolved intent, affected
resources or destructive choices not covered by the request.

1. Read the affected records and inspect scan bounds, pagination and permissions.
   Zero discovered uses is not proof of no external CSS, plugin or inaccessible-page
   references. A single-use component or duplicate color can be intentional.
2. Choose the smallest repair; preserve opaque fields, existing IDs and unrelated
   references. Use fresh resource-specific ownership/digests and required deletion
   acknowledgements. Back up supported global resources before destructive cleanup.
3. Apply sequentially where ownership changes; on conflicts re-read/rebase the
   still-authorized edit. Do not delete edited or unowned resources by name alone.
4. Re-run relevant checks and report the actual changes, remaining findings and
   coverage limits. Use **bricks-quality-gate** for broad/shared-resource effects.

## Things the audit misses (and you should mention)

- **Naming inconsistency**: mix of `camelCase` / `kebab-case` / `snake_case` across classes or variables. The audit does not check naming conventions. Scan `list-global-classes` / `list-global-variables` manually if the user asks.
- **Semantic overlap**: `.btn` and `.button` are both used, defining similar styles. The audit can't infer intent. Suggest merging if you see it.
- **Scale gaps**: spacing or typography scale missing middle steps. Read `list-global-variables` and check for numeric/t-shirt continuity.
- **Unused palette entries**: palette colors not referenced by any class, variable, or element setting. The audit doesn't scan for this; add it to the manual pass if the palette is large.

## When not to run this

- Right after a fresh install (`get-design-context` is empty): there's nothing to audit. Use the **bricks-seed-design-system** skill instead.
- Mid-edit, when the user is actively working on design tokens: the audit will flag in-progress work as "unused." Wait until a stable point.
