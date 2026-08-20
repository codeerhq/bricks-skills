---
name: bricks-maintenance
description: "Use when running Bricks housekeeping: \"regenerate all CSS files\", \"find orphaned elements\", \"clean up abandoned builder data\". Covers `bricks/regenerate-css-files`, `bricks/list-orphaned-elements`, `bricks/cleanup-orphaned-elements`. Excludes code-signature regeneration."
---

**Requires:** Bricks 2.4+ with the Abilities API enabled

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

Cleanup supports a dry run and sweeps all detected orphans:

```
bricks/cleanup-orphaned-elements({ dryRun: true })
  -> { success: true, dryRun: true, totalCleaned: 47, postsCleaned: 12, message: "Would remove 47 orphaned elements across 12 posts." }

# After review and explicit approval:
bricks/cleanup-orphaned-elements({ dryRun: false })
  -> { success: true, totalCleaned: 47, postsCleaned: 12, message: "Removed 47 orphaned elements across 12 posts." }
```

**Destructive unless `dryRun: true`.** Always list first, run the dry run, review the affected posts, and obtain explicit approval before the committing call. There is no MCP parameter for limiting cleanup to a selected post list.

## What's excluded

Code-signature regeneration exists in the admin UI, but it is not registered as an MCP ability. It will not appear in `bricks/list-ability-status`, and it should stay admin-only because regenerating signatures can unblock previously quarantined code.

Academy reference: https://academy-preview.bricksbuilder.io/builder/features/code-signatures/

## Tool availability

> **If a `bricks/*` ability is not available as a direct tool**: first check whether it is outside the fast path and call it through `mcp-adapter-execute-ability` with `ability_name: "bricks/<name>"`. If the dispatcher also rejects it, call `bricks-list-ability-status` to check whether a site admin disabled it under Bricks > AI.

## Typical flow: post-migration cleanup

```
bricks/list-orphaned-elements
  -> { totalOrphans: 47, totalPosts: 12, orphansByPostId: {...} }

# Preview and review the affected posts:
bricks/cleanup-orphaned-elements({ dryRun: true })
  -> { success: true, dryRun: true, totalCleaned: 47, postsCleaned: 12, message: "Would remove 47 orphaned elements across 12 posts." }

# After explicit approval:
bricks/cleanup-orphaned-elements({ dryRun: false })
  -> { success: true, totalCleaned: 47, postsCleaned: 12, message: "Removed 47 orphaned elements across 12 posts." }

bricks/regenerate-css-files
  -> { success: true, generatedFileCount: 1423, cssLoading: "file" }
```

## Don't

- Don't pass `postIds` to maintenance abilities. Current schemas do not accept it.
- Don't commit `cleanup-orphaned-elements` without reviewing both `list-orphaned-elements` and a `dryRun: true` result first.
- Don't try to regenerate code signatures through MCP. There is no signature-regeneration ability.
