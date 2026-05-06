---
name: quality-gate
description: "Use after every write through the Bricks MCP: set-page-elements, update-element, set-template-conditions, set-global-variables, create-theme-style, etc. Defines the verify-after-write loop: read back the change, render the affected post, check for silent failures (empty render, unknown tags, unbalanced braces, query:null). Catches the \"tool returned success but the page broke\" class of bugs."
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

# Bricks: quality gate (verify-after-write)

Bricks MCP write abilities are not transactional. They can succeed at the meta-update level, return a clean response, and still leave the page broken: wrong meta key, lost reference, silently-rejected setting, dynamic tag with a typo. **Always verify after writing.** Use this as the checklist.

> **If a `bricks/*` ability is not available as a direct tool**: first check whether it is outside the fast path and call it through `mcp-adapter-execute-ability` with `ability_name: "bricks/<name>"`. If the dispatcher also rejects it, call `bricks-list-ability-status` to check whether a site admin disabled it under Bricks > Settings > AI.

## The contract

After **every** write, run the matching read and the matching render check. If either disagrees with what you wrote, **stop and surface to the user**: don't keep building on a broken foundation.

| Wrote | Verify with |
|---|---|
| `update-element`, `add-element`, `remove-element` | `get-page-elements` (post id): confirm the change in the returned tree |
| `set-page-elements` | `get-page-elements`: diff vs what you sent |
| `set-template-conditions` | `get-template` (id): confirm `templateConditions` round-tripped |
| `create-template`, `set-template-settings` | `get-template` / `get-template-settings`: confirm `type`, `title`, settings |
| `set-global-variables` | `list-global-variables`: confirm count and shape |
| `create-color`, `update-color`, `delete-color` | `list-color-palettes (paletteId)`: diff colors array |
| `create-color-palette`, `update-color-palette`, `delete-color-palette` | `list-color-palettes`: confirm presence/absence |
| `create-theme-style`, `update-theme-style` | `get-theme-styles (id)`: confirm settings + conditions |
| `create-global-class`, `update-global-class` | `list-global-classes`: confirm class settings |
| `create-component`, `update-component`, `extract-component-from-elements` | `get-component (id)`: confirm tree, properties, variants |
| `regenerate-css-files` | spot-check a frontend page in the browser-verify skill |
| `reindex-filters` | `list-query-filters`: confirm filters still resolve their target queries |

## Pre-write check (cheap and prevents 80% of silent failures)

Before writing dynamic-data tags into element settings, **always** preview them:

```
preview-dynamic-tag (tag: "{your_tag:modifier}", postId: <where it'll render>, context: "text")
-> check: rendered, isEmpty, unknownTags
```

If `unknownTags` is non-empty, the tag will render as literal text in production: fix the name (use `list-dynamic-data-tags` to discover the right one) before writing.

If `isEmpty: true` and the post should have a value, the tag is wrong or the field isn't populated on that post: surface to the user; don't silently write an empty-rendering tag.

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
- Unknown keys in `set-global-variables` (variable shape must be exactly `{ id, name, value, category }`).
- Unknown enum values in template `conditions[i].main` (must be one of `any`, `frontpage`, `postType`, `archiveType`, `search`, `error`, `terms`, `ids`, `hook`).
- Term identifiers not in `taxonomy::id` form.

If you got back a `bricks_*` error code from one of these, **do not retry the same payload**. Read the message, fix the shape, then write.

### 3. Reference integrity

Some writes can orphan references that no validator catches:

- Renaming a CSS variable in `set-global-variables` doesn't update existing element settings that reference `var(--old-name)`. After the rename, **search the design system** for stale references:
  - `list-global-classes` -> grep settings for `var(--old-name)`.
  - `list-templates` + `get-page-elements` for each -> grep for `var(--old-name)`.
  - `get-theme-styles` -> grep for `var(--old-name)`.
- Deleting a color (`delete-color`) silently breaks every `var(--name)` reference. Same search before deleting.
- Deleting a global class silently breaks every element that named it in `_cssGlobalClasses`. Search elements before deleting.

### 4. Render verification

For UI-affecting changes (layout, typography, color), the meta-write succeeded does not mean the rendered page is correct. Use the `browser-verify` skill to:

1. Open the affected frontend URL.
2. Visually confirm the change is present.
3. Check the browser console for runtime errors.
4. Resize to test responsive breakpoints if the change is layout-related.

Type-checking and PHP linting verify code correctness, not feature correctness. **If you can't render-verify the change, say so explicitly to the user** rather than reporting "done."

### 5. Pagination and "did I read everything?"

`list-*` abilities are paginated. `hasMore: true` in the response means you only saw a subset. For verify-after-write, **scope the read to the resource you wrote** (filter by id, paletteId, type, etc.): never rely on page-1 results to confirm something you wrote that might be on page 5.

## When verify fails: the response

1. **Surface immediately.** Don't try to "fix" it with more writes: you may compound the corruption.
2. **Show the diff.** Tell the user what you wrote vs what you read back.
3. **Stop the workflow.** If you were in the middle of a multi-step plan, pause until the user confirms the right next step (retry, rollback, escalate).
4. **Check for revisions.** If the resource has revisions (`list-revisions`), confirm the bad write created a revision so it can be rolled back via `restore-revision`.

## Common silent-failure smells

- Tool returned success but `get-*` shows the old state -> save was vetoed by a hook (look for `bricks/save_*` filters in the project's custom code).
- Element id in your write doesn't appear in the read-back tree -> wrong post id, wrong area, or the element was inside a component you didn't read.
- Theme style created but no visual change on the frontend -> empty `conditions` array (silently inert) or condition doesn't match the page you tested.
- `set-template-conditions` succeeded but template still doesn't render -> another template of the same type has a higher score (see `templates-conditions` scoring).
- Global variable rename done; `list-global-variables` shows the new name but elements still emit the old `var()` -> element settings reference the old name; do the reference-integrity sweep.

## Cost / latency tradeoff

Verify-after-write doubles your tool-call count for write operations. Worth it. The cost of a silent regression that the user discovers in the browser tomorrow is much higher than twice the tool calls today.

For batches: group reads by resource when the writes are independent. You save calls, but the failure report is less granular, so keep destructive writes isolated.

## Ability compatibility checklist

Use this when checking whether a site's Bricks abilities are installed, enabled, and returning safe results. Skip this for normal site-building work:

1. Start with `bricks-get-mcp-version`, `bricks-list-ability-status`, `mcp-adapter-discover-abilities`, and `mcp-adapter-get-ability-info` for every `bricks/*` ability.
2. Record enabled, disabled, default-enabled, direct-tool availability, dispatcher availability, annotations, and permission results. Builder-permission abilities are expected to be default-off unless the admin explicitly enables them.
3. Run an invalid-input sweep against every ability, including no-argument abilities. Unknown top-level parameters should return stable structured Bricks or schema errors, never raw PHP messages.
4. Assert credential redaction: license/API/code-execution/template-source secrets must never be returned as values. Credential status abilities may return configured/readable/writable booleans only.
5. For media tests, clean up uploads with `bricks/delete-media` or record the persistent attachment ID. For global data tests, capture `beforeDelete` snapshots or export a small rollback bundle before destructive cleanup.
6. Keep remote-template tests lightweight by using `list-remote-templates` default summary mode and a small `perPage` to choose a template. Use `bricks/insert-remote-template` for insertion. Use `mode: "full"` only when intentionally inspecting the complete remote payload for debugging.

## Related skills

- `browser-verify`: render-verification on the frontend.
- `dynamic-data`: `preview-dynamic-tag` pre-write check + `unknownTags` interpretation.
- `templates-conditions`: scoring rules for "which template won" investigations.
- `headers-footers`: area-routing context for element-write verifies.
