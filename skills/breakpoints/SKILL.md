---
name: breakpoints
description: "Use when reading, adding, removing, or reordering Bricks responsive breakpoints. Covers `bricks/list-breakpoints` / `bricks/set-breakpoints`, mobile-first vs desktop-first semantics, and how breakpoint writes interact with the generated CSS."
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

# Bricks: breakpoints (via MCP)

Bricks ships default breakpoints (`desktop`, `tablet_portrait`, `mobile_landscape`, `mobile_portrait`) and lets you add custom ones. The full set lives in the `bricks_breakpoints` option and drives both the builder device-switcher and the generated responsive CSS.

Two tools:

1. **`bricks/list-breakpoints`**: returns `{ customEnabled, isMobileFirst, baseKey, baseWidth, breakpoints, defaults }`. `baseKey` / `baseWidth` identify the base row; `isMobileFirst` is derived by core Bricks from the stored breakpoint list before it sorts the list for output (`includes/breakpoints.php:433-444`).
2. **`bricks/set-breakpoints`**: write the full list. Accepts `{ breakpoints: [ ... ], customEnabled?: boolean }` and replaces the existing set atomically. `customEnabled` flips the global custom-breakpoints master toggle.

## Shape

Each breakpoint is an object:

```
{
  key: "tablet_portrait",   // machine key, unique: /^[a-z0-9_-]+$/i
  label: "Tablet portrait", // shown in builder, required non-empty
  width: 991,               // integer >= 0: see paradigm below
  icon: "bricks-icon-device-tablet", // optional
  base: true                // omit or false on all other rows
}
```

One and only one row must have `base: true`. The base is the fallback: every other breakpoint is a media query relative to it. `base` is a boolean on the row itself, not a `type` enum.

## Mobile-first vs desktop-first

Bricks derives the paradigm from **which row is the base**, not from a separate setting:

- **Desktop-first (Bricks default):** the base row is not the last row in the saved breakpoint list. Base styles apply everywhere; narrower breakpoints layer on as `@media (max-width: Npx)`.
- **Mobile-first:** the base row is the last row in the saved breakpoint list. Base styles apply from `0` upward; wider breakpoints layer on as `@media (min-width: Npx)`.

`list-breakpoints` exposes the derived result as `isMobileFirst: boolean`. There is no `cssBreakpointType` global setting. If you change the base row, call `list-breakpoints` after saving and verify `isMobileFirst` before continuing.

**Caution:** use `bricks/set-breakpoints` for reading, restoring, adding, removing, or width changes when you can verify the result immediately. For a desktop-first to mobile-first paradigm switch, stop unless `list-breakpoints` confirms `isMobileFirst: true` after the write. Core Bricks derives the paradigm from stored base-row position, and the ability writer also sorts the replacement list before saving (`includes/abilities/breakpoints.php:242-249`), so the readback is the contract.

**A master "use custom breakpoints" toggle (`customBreakpoints`) in `bricks_global_settings` controls whether your custom set is applied at all: Bricks falls back to the built-in defaults when it's off.** That key is not in the `bricks/set-global-settings` registry. Use `bricks/set-breakpoints` with `customEnabled: true` or `customEnabled: false`, then verify with `list-breakpoints.customEnabled`.

**Switching paradigm rewrites every rendered stylesheet.** Regenerate CSS files (`bricks/regenerate-css-files`) after the write when `cssLoading=file`: otherwise cached files lag the new media-query semantics. `set-breakpoints` returns a `note` field prompting the regen when the flag is set.

## Ordering

`set-breakpoints` sorts rows by width before saving. Submit a clear complete list, then read back with `list-breakpoints` and use the returned order and `isMobileFirst` value as truth for generated CSS.

## Removing a breakpoint

- Any element with settings keyed to that breakpoint keeps the data (Bricks never deletes element settings on breakpoint removal: it becomes orphaned).
- Regenerate CSS after removal to drop the now-unused media queries from emitted files.

## Tool availability

> **If a `bricks/*` ability is not available as a direct tool**: first check whether it is outside the fast path and call it through `mcp-adapter-execute-ability` with `ability_name: "bricks/<name>"`. If the dispatcher also rejects it, call `bricks-list-ability-status` to check whether a site admin disabled it under Bricks > Settings > AI.

## Typical flow: add a custom "large-desktop" breakpoint (min-width paradigm)

```
bricks/list-breakpoints
  -> current: [desktop (base, 1279), tablet_portrait (991), mobile_landscape (767), mobile_portrait (478)]

bricks/set-breakpoints
  customEnabled: true
  breakpoints:
    - { key: "mobile_portrait",   label: "Mobile portrait",   width: 478 }
    - { key: "mobile_landscape",  label: "Mobile landscape",  width: 767 }
    - { key: "tablet_portrait",   label: "Tablet portrait",   width: 991 }
    - { key: "desktop",           label: "Desktop",           width: 1279, base: true }
    - { key: "large_desktop",     label: "Large desktop",     width: 1600 }

bricks/regenerate-css-files
```

The explicit `base: true` stays on `desktop`; the new `large_desktop` stacks above it.

## Don't

- Don't submit an array without exactly one `base: true`: the write is rejected with `bricks_invalid_param` (param `breakpoints`).
- Don't reuse an existing `key` for a new breakpoint: Bricks stores per-breakpoint settings under that key and you'll silently merge with the old data.
- Don't skip the CSS regen after reordering or removing a breakpoint.
