---
name: bricks-maintenance
description: "Use when running Bricks housekeeping: \"regenerate all CSS files\", \"find orphaned elements\", \"clean up abandoned builder data\". Covers `bricks/regenerate-css-files`, `bricks/list-orphaned-elements`, `bricks/cleanup-orphaned-elements`. Excludes code-signature regeneration."
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

# Bricks: maintenance (via MCP)

Three admin-only housekeeping abilities mirror Bricks maintenance actions (`includes/abilities/maintenance.php`):

- **`bricks/regenerate-css-files`**: rebuild Bricks CSS files.
- **`bricks/list-orphaned-elements`**: scan for element rows whose `parent` id no longer exists in the same tree.
- **`bricks/cleanup-orphaned-elements`**: remove those orphan rows.

## `bricks/regenerate-css-files`

Input schema is empty:

```
bricks/regenerate-css-files
  -> { success: true, generatedFiles: [...], generatedFileCount: 42, cssLoading: "file" }
```

There is no `postIds` parameter. The ability runs the site-wide Bricks file-regeneration helper.

Use it after:

- Adding, removing, or reordering breakpoints.
- Bulk-editing theme styles, variables, or global classes outside normal builder saves.
- Migrating many element trees or template styles.
- Switching `cssLoading` to file mode and needing the generated files ready.

Normal builder saves regenerate the affected post CSS automatically. This ability is the bulk version.

## Orphaned elements

An orphan is an element whose `parent` id references another element that does not exist in the same meta tree.

The list operation is read-only:

```
bricks/list-orphaned-elements
  -> { totalOrphans: 47, totalPosts: 12, orphansByPostId: { "42": [...] } }
```

Cleanup input schema is empty and sweeps all detected orphans:

```
bricks/cleanup-orphaned-elements
  -> { success: true, totalCleaned: 47, postsCleaned: 12, message: "Removed 47 orphaned elements across 12 posts." }
```

**Destructive.** Always run `list-orphaned-elements` first and review the affected posts. There is no MCP parameter for limiting cleanup to a selected post list.

## What's excluded

Code-signature regeneration exists in the admin UI, but it is not registered as an MCP ability. It will not appear in `bricks/list-ability-status`, and it should stay admin-only because regenerating signatures can unblock previously quarantined code.

Academy reference: https://academy-preview.bricksbuilder.io/builder/features/code-signatures/

## Tool availability

> **If a `bricks/*` ability is not available as a direct tool**: first check whether it is outside the fast path and call it through `mcp-adapter-execute-ability` with `ability_name: "bricks/<name>"`. If the dispatcher also rejects it, call `bricks-list-ability-status` to check whether a site admin disabled it under Bricks > AI.

## Typical flow: post-migration cleanup

```
bricks/list-orphaned-elements
  -> { totalOrphans: 47, totalPosts: 12, orphansByPostId: {...} }

# Review the affected posts. If cleanup is expected:
bricks/cleanup-orphaned-elements
  -> { success: true, totalCleaned: 47, postsCleaned: 12, message: "Removed 47 orphaned elements across 12 posts." }

bricks/regenerate-css-files
  -> { success: true, generatedFileCount: 1423, cssLoading: "file" }
```

## Don't

- Don't pass `postIds` to maintenance abilities. Current schemas do not accept it.
- Don't run `cleanup-orphaned-elements` without reviewing `list-orphaned-elements` first.
- Don't try to regenerate code signatures through MCP. There is no signature-regeneration ability.
