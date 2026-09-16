---
name: bricks-quality-gate
description: "Verify broad, destructive, multi-resource or uncertain Bricks changes with adequate persisted-state and runtime evidence."
---

# Bricks: quality gate (verify-after-write)

Some Bricks writes can succeed at the storage layer and still leave the page broken: wrong routing, a lost reference, a silently rejected setting, or a mistyped dynamic tag. Verify in proportion to the write and use authoritative mutation readback instead of repeating it.

> **If a `bricks/*` ability is not available as a direct tool**: first check whether it is outside the fast path and call it through `mcp-adapter-execute-ability` with `ability_name: "bricks/<name>"`. If the dispatcher also rejects it, call `bricks-list-ability-status` to check whether a site admin disabled it under Bricks > AI.

## Verification approach

Inspect every mutation response for target identity, persisted changed values (or
an equivalent authoritative result), normalization/omissions and completion state.
When it establishes those facts for a focused change, do not repeat the same read.
A revision ID alone proves neither the requested values nor the final tree; versions
and digests are guards, not semantic readback. Read the affected resource when those
facts are absent, a write is broad/destructive, or the response reports uncertainty.
Use render/browser evidence for the behavior the change affects. Stop dependent
writes when checks disagree and investigate the actual persisted state.

| Wrote | Explicit verification when mutation readback is insufficient |
|---|---|
| `update-element`, `batch-update-elements`, `add-element`, `remove-element` | `get-page-elements` (post id): confirm the changed element ids in the returned tree |
| `update-element-conditions` | `get-element-conditions`: confirm `_conditions` round-tripped and group/item counts match intent |
| `update-element-interactions` | `get-element-interactions`: confirm `interactions` round-tripped and check `effectiveInteractions` for inherited class rows |
| `set-page-elements` | `get-page-elements`: diff vs what you sent |
| `set-template-conditions` | `get-template` (id): confirm `templateConditions` round-tripped |
| `create-template`, `set-template-settings` | `get-template` / `get-template-settings`: confirm `type`, `title`, settings |
| `set-global-variables` | `list-global-variables`: confirm count and shape |
| `create-color`, `update-color`, `delete-color` | `list-color-palettes (paletteId)`: diff colors array |
| `create-color-palette`, `update-color-palette`, `delete-color-palette` | `list-color-palettes`: confirm presence/absence |
| `create-theme-style`, `update-theme-style` | `get-theme-styles (id)`: confirm settings + conditions |
| `create-global-class`, `update-global-class` | `list-global-classes`: confirm class settings |
| `create-component`, `update-component`, `extract-component-from-elements` | `get-component (id)`: confirm tree, properties, variants, `_version`, `propertyGroups`, slot elements, `slotChildren`, nested component `properties`, and returned `designSystemVersion` |
| `delete-component` | `get-design-context (includeUsage: true)`: confirm the component is absent and no unexpected references remain |
| `regenerate-css-files` | spot-check a frontend page in the bricks-browser-verify skill |
| `reindex-filters` | `list-query-filters`: confirm filters still resolve their target queries |

## Pre-write checks

Global design writes use resource-specific ownership and digest preconditions.
Copy the complete ownership values from one latest matching read; never reconstruct
them from `designSystemVersion` or mix values from different reads:

- Classes: single create uses no resource ownership and only needs
  `expectedCategoryOwnership` when categorized. Batch create uses
  `list-global-classes.ownership`; update/delete use the target `itemOwnership` as
  `expectedOwnership` plus `lockOwnership`. Categorized batch/update writes also use
  `categoryOwnership`.
- Variables/categories: `variableOwnership` + `categoryOwnership`; item delete uses
  the exact variable `itemOwnership` and literal `allowOrphans: true`.
- Palettes/colors: resource `ownership` for creates, target `itemOwnership` for
  updates/deletes, and preview `saveOwnership` for saved shade generation.
- Theme-style updates/deletes: the target `itemOwnership` from a complete current
  theme-style read. Do not derive it from summarized visible settings. Deleting a
  non-empty style additionally requires reviewed `acknowledgeStyleRemoval: true`.
- Components: current `expectedDesignSystemVersion` plus full
  `expectedComponentDigest`; slot/deletion acknowledgements are additional, not
  substitutes for either precondition.
- Breakpoints/pseudo-classes: their latest resource ownership. Breakpoint writes
  that include `customEnabled` also require current global-settings ownership.

On an ownership/digest conflict, re-read and rebase the intended edit. Do not retry
the stale payload.

For unfamiliar dynamic tags, discover the current tag/controls and preview against
a representative post when that context can represent the intended use:

```
preview-dynamic-tag (tag: "{your_tag:modifier}", postId: <representative post>, context: "text")
```

Inspect `rendered`, `isEmpty` and `unknownTags`. Resolve unknown tags before using
them. Empty output can be valid missing data or the wrong preview context; it is not
by itself a broken field. This ability does not accept an arbitrary term/user/ACF
loop row. Verify those expressions in their actual loop context and report missing
runtime evidence instead of rejecting a valid tag from an unrelated post preview.

For broad same-post element setting edits, validate first when the write ability offers a dry run. If normalization changes settings you did not intend, stop before saving.

## Post-write check categories

### 1. Meta routing (header/footer)

When writing to a `bricks_template` post:

1. After the write, call `get-page-elements (postId)`: the response should include the new/updated element.
2. If the post is `_bricks_template_type = header`, the tree must come from `_bricks_page_header_2` automatically: `get-page-elements` handles routing; if the response is empty after a successful write, the area inference is wrong (file a bug, don't keep writing).

### 2. Validation rejections (caught at write time, but verify the message)

The Bricks MCP write layer rejects:
- `query: null` and queries missing `objectType` -> `set-page-elements`, `add-element`, `update-element`.
- Empty / malformed `link` settings (external without url, internal without postId) -> element link controls.
- Unbalanced `{` / `}` in non-code settings -> dynamic-data sanity check.
- Unknown keys in `set-global-variables` (use complete rows returned by the current
  contract; response-only `itemDigest` / `itemOwnership` are stripped safely).
- Unknown enum values in template `conditions[i].main` (must be one of `any`, `frontpage`, `postType`, `archiveType`, `search`, `error`, `terms`, `ids`, `hook`).
- Invalid element `_conditions` groups, missing `key`, invalid `compare`, or incomplete `dynamic_data` rows.
- Invalid element `_interactions` trigger/action/target values, missing required action fields, inline JavaScript payloads, or JavaScript callback args without valid row data.
- Term identifiers not in `taxonomy::id` form.

If you got back a `bricks_*` error code from one of these, **do not retry the same payload**. Read the message, fix the shape, then write.

### 3. Reference integrity

Some writes can orphan references that no validator catches:

- Renaming a CSS variable in `set-global-variables` doesn't update existing element settings that reference `var(--old-name)`. After the rename, **search the design system** for stale references:
  - `list-global-classes` -> grep settings for `var(--old-name)`.
  - Inventory editable pages/posts/templates with `checkout-site-repository`, following cursors, then inspect their complete element settings. Also inspect component definitions, including nested instances.
  - Record pagination, permission and scan limits; zero bounded matches do not prove a site-wide absence of use.
  - `get-theme-styles` -> grep for `var(--old-name)`.
- Deleting a color (`delete-color`) silently breaks every `var(--name)` reference. Same search before deleting.
- Deleting a global class silently breaks every element that named it in `_cssGlobalClasses`. Search elements before deleting.
- Deleting a component can orphan every element instance with the deleted `cid`, including nested instances inside other component definitions. Before deleting, read `get-component` for the full `componentDigest` and `get-design-context` with `includeUsage: true`; pass `expectedDesignSystemVersion`, `expectedComponentDigest`, the reviewed `expectedUsageCount`, and literal `allowOrphans: true`. Show affected posts/templates/components before the delete. The acknowledgement is mandatory even at zero discovered usages.
- Global-data writes are not revision-backed. Before a destructive change, use `bricks/list-transfer-items` and `bricks/export-transfer-package` to save the affected supported items. Restore only after `bricks/inspect-transfer-package`, passing its returned `zipHash` as `expectedZipHash` plus explicit item IDs. Any replacement requires clear user intent and `allowOverwrite: true`. Load **bricks-import-export** for the full flow.

### Component write integrity

For component writes, check these specifically:

- `update-component` used both the latest `designSystemVersion` and complete
  `componentDigest` from current reads. On either conflict, re-read and merge instead
  of retrying the stale payload.
- `get-component` returns `_version`. Missing `_version` makes the builder treat the component as an old beta component and highlight it in red.
- Every property `connections` key exists as an element id inside the component tree.
- Every nested component instance property key exists on the referenced component.
- Every parent-property reference uses `parent:cid_<componentId>:prop_<propertyId>` and points at the current outer component id after create/update remapping.
- Every `slotChildren` key is a real `slot` element id on the referenced component, and every slotted child id exists in the same tree.
- If `elements` were replaced on `update-component`, unchanged `properties` must still point at surviving element ids.
- If existing slots were removed, `allowSlotOrphans: true` was an explicit reviewed
  acknowledgement; bounded usage evidence is not proof that no instance content exists.

### 4. Render verification

For UI-affecting changes (layout, typography, color), the meta-write succeeded does not mean the rendered page is correct. Use the `bricks-browser-verify` skill to:

1. Open the affected frontend URL.
2. Visually confirm the change is present.
3. Check the browser console for runtime errors.
4. Resize to test responsive breakpoints if the change is layout-related.

Report any render checks that could not be completed.

### 5. Pagination and "did I read everything?"

`list-*` abilities are paginated. `hasMore: true` in the response means you only saw a subset. For verify-after-write, **scope the read to the resource you wrote** (filter by id, paletteId, type, etc.): never rely on page-1 results to confirm something you wrote that might be on page 5.

## When verify fails: the response

1. Stop dependent mutations and compare the requested change with actual readback.
2. Determine whether the operation failed before writing, committed partially, or
   completed with normalization. Preserve returned recovery/idempotency identifiers.
3. Re-read and rebase a still-authorized focused edit on an ownership conflict. Do
   not resend the stale payload or replay a whole partially committed operation.
4. Continue a safe correction/resume within existing authorization. Ask only when
   identity, intended scope or a destructive recovery choice remains ambiguous.
5. Use the matching recovery contract: page revisions where supported; inspected
   transfer backups or durable changeset recovery for applicable global operations.

## Common silent-failure smells

- Tool returned success but `get-*` shows the old state -> save was vetoed by a hook (look for `bricks/save_*` filters in the project's custom code).
- Element id in your write doesn't appear in the read-back tree -> wrong post id, wrong area, or the element was inside a component you didn't read.
- Theme style created but no visual change on the frontend -> empty `conditions` array (silently inert) or condition doesn't match the page you tested.
- `set-template-conditions` succeeded but template still doesn't render -> another template of the same type has a higher score (see `templates-conditions` scoring).
- `update-element-conditions` succeeded but the element still renders -> another OR group matches, or the page/template you tested is not the same context used by the condition.
- `update-element-interactions` succeeded but the old behavior still fires -> the interaction may be inherited from a global class. Check `effectiveInteractions`.
- Global variable rename done; `list-global-variables` shows the new name but elements still emit the old `var()` -> element settings reference the old name; do the reference-integrity sweep.

## Batch verification

For independent same-post element setting edits, prefer one batch write plus one readback over several update/read cycles. Keep destructive, uncertain, or user-sensitive changes isolated.

## Ability compatibility checklist

Use this when checking whether a site's Bricks abilities are installed, enabled, and returning safe results. Skip this for normal site-building work:

1. Start with `bricks-get-mcp-version`, `bricks-list-ability-status`, `mcp-adapter-discover-abilities`, and `mcp-adapter-get-ability-info` for every `bricks/*` ability.
2. Record enabled, disabled, default-enabled, direct-tool availability, dispatcher availability, annotations, and permission results. Builder-permission abilities are expected to be default-off unless the admin explicitly enables them.
3. Keep ordinary compatibility checks read-only. Invalid-input or mutation probes belong on an explicitly authorized disposable test site with known fixtures and recovery.
4. Assert credential redaction: license/API/code-execution/template-source secrets must never be returned as values. Credential status abilities may return configured/readable/writable booleans only.
5. In authorized mutation tests, track created fixture IDs and clean up only owned fixtures within the approved scope. Retain existing media and global resources.
6. Keep remote-template tests lightweight by using `list-remote-templates` default summary mode and a small `perPage` to choose a template. Use `bricks/insert-remote-template` for insertion. Use `mode: "full"` only when intentionally inspecting the complete remote payload for debugging.

## Related skills

- `bricks-browser-verify`: render-verification on the frontend.
- `bricks-dynamic-data`: `preview-dynamic-tag` pre-write check + `unknownTags` interpretation.
- `bricks-templates-conditions`: scoring rules for "which template won" investigations.
- `bricks-element-conditions`: OR/AND grouping and element render rules.
- `bricks-interactions`: inherited class rows, required action fields, and frontend interaction debugging.
- `bricks-headers-footers`: area-routing context for element-write verifies.
