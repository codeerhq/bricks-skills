---
name: bricks-agent-repository
description: Use only after direct exact-target and typed checkout-to-commit routes are insufficient, such as ambiguous matches, unsupported operations, oversized documents, dependency audits, or recovery. Never load merely because an exact task spans multiple targets whose live tools already advertise the requested operations.
---

# Bricks agent repository

Treat Bricks as a typed repository while WordPress remains authoritative.

## Explicit host-owned file workspace

Use this route only when the task environment explicitly announces
`bricks.workspace/v1`. The projected files are a temporary authorized checkout,
not a persistent second source of truth:

1. Inspect and edit only the supplied resource files with ordinary file tools.
2. Preserve opaque fields, IDs, baselines, and files outside the requested scope.
3. Do not edit host metadata, credentials, session files, or baseline digests.
4. Do not call resolve, commit, changeset, or focused mutation abilities in
   parallel. The host alone validates changed files, applies them through CAS and
   journals, and performs authoritative readback after the agent finishes.
5. Report the intended file changes without claiming WordPress persistence; the
   host result is authoritative.

Never infer `bricks.workspace/v1` from filenames, a `.bricks` directory, an
installed skill, or prior tasks. If the host does not announce it, use the ability
routes below.

## Choose the smallest surface

- For one exact known target, no skill is required: use the focused ability or the self-described `resolve-agent-file` → `commit-agent-file` path.
- For an oversized or complex page/template edit that needs explicit preview, use a page workspace.
- For one existing class, variable, theme style, or component needing lossless structural editing, use a design-resource workspace.
- When a small edit has exact page/component/element IDs, exact unique page/component names, or exact current text/labels and the one-call schema supports the operation, use `commit-exact-site-edits` without loading this skill. Guard with `expectedValue`, or explicit `allowBlindWrite: true` only for an intentional exact user-supplied target.
- For typed targets that still need discovery, use operations advertised by `checkout-site-edit-map` before falling back to canonical files.
- For 2-25 coordinated existing resources outside that typed vocabulary, use one site changeset.
- Use the site manifest only when the target is unknown, ambiguous, broad, or dependency discovery is necessary. Never fetch every full document merely to locate one target.

## Workflow

1. If the target is not already exact, call `bricks/checkout-site-repository` with the narrowest `query`, `postTypes`, `designKinds`, `includeDocuments`, `includeDesign`, `includeDependencies`, and `perPage` values that answer the task. Follow opaque cursors only when later entries may matter. Skip the manifest for a known exact target.
2. Use `bricks-commit-exact-site-edits` first for any small edit its live schema supports. Exact selectors can be IDs, exact unique page/component names, or exact current element text/labels; unique prefixes are deliberately rejected. Certified operations cover page text replacement and insertion, component-definition text/labels/accessibility attributes, global-variable values, and individual class/theme-style leaves. Supply `expectedValue`; use literal `allowBlindWrite: true` only for an intentional exact user-supplied target. Component attributes on this route are deliberately limited to `role` and `aria-*`; use the canonical file route when broader custom attributes are genuinely required. If target discovery or a fresh visible selection is needed, call `bricks-checkout-site-edit-map`. Its exact input is `{ "targets": [{ "scope": "page", "postId": 13 }, { "scope": "design", "resource": "globalVariable", "id": "accent" }], "elementIds": ["bbbbbb"] }`; omit `elementIds` when IDs are unknown, and never substitute `pageIds`, resource-specific ID arrays, or `responseFormat`. Copy each exact element or variable resource's workspace-bound `selectionRef` into one supported operation and submit the plan once through `bricks-commit-site-edit-plan` with one stable idempotency key. Repeat that exact commit call to resume or replay safely. Use the longer `resourcePath` plus `selectionDigest` contract only with dispatcher ability `bricks/preview-site-edit-plan` when the user explicitly asks for a dry run. Never invent an operation absent from `editableOps`, mutate a component-instance boundary, or overwrite property-controlled component content. Otherwise checkout only the required canonical workspace or one changeset containing the exact 2-25 targets. For a known target that fits the canonical two-call path below, skip workspace checkout too.
3. Preserve target, schema, baseline, ownership, digest, opaque data, IDs, slots, properties, and variants. Edit only the canonical payload.
4. Preview once. Treat validation, normalization, ownership, reference, permission, and stale errors as planning feedback.
5. Apply only the returned token with one stable idempotency key. Continue from authoritative readback; inspect any normalization delta.
6. Verify affected Builder/frontend behavior when browser access exists.

## Typed existing-site plan

The typed route keeps canonical Bricks files server-side and exposes bounded public outlines. It is an optimization over Site Changeset, not another persistence engine:

- Use `commit-exact-site-edits` as the one-call route when an exact selector and a certified operation are already known. The server performs name resolution, canonical checkout, selection/boundary validation, CAS, durable Site Changeset, and authoritative readback internally.
- Treat `workspaceToken` and every `selectionDigest` as opaque and short-lived.
- Use only the operation names and selectors advertised by the live response/schema. Current typed operations can include `set-text`, page-only `insert-text-before`, component-only `set-element-label` and `set-element-attributes`, `set-variable-value`, and `set-design-setting`. Component instances and public-property-controlled definition fields remain fail-closed.
- Do not rediscover or edit consumers of a shared variable merely to prove propagation; the design resource remains authoritative and Site Changeset returns canonical readback.
- Use `commit-site-edit-plan` as the common second call with one stable idempotency key and `responseFormat: "summary"`; it previews and applies through Site Changeset server-side. Repeat the same call for resume/replay. Request `document` only when another edit genuinely needs the complete canonical readback.
- Fall back to canonical files for links, broad structure, unsupported style leaves or element types, component properties/instances, non-accessibility custom attributes, or any truncated map.

## Two-call known-target path

When `bricks/resolve-agent-file` and `bricks/commit-agent-file` are available, call resolve first with an exact `scope`, `query`, and optional `resourceKinds` array. Proceed only when it returns one target and canonical document. Treat its `editingContract` as authoritative for canonical keys, native style shapes, responsive suffixes, flat-tree ordering, and preservation rules; do not invent alternate shapes. Commit the unchanged target plus the requested edit using one stable idempotency key. Prefer compact authoritative readback; request the full document only when another edit genuinely needs it.

For custom attributes, preserve ordered `_attributes` records shaped as `{ "id"?: string, "name": string, "value": string }`. The returned editing contract is authoritative.

## Changesets

There is no atomic whole-site transaction across WordPress hooks, assets, caches, and plugins. The changeset is a durable coordinator:

- Keep every intermediate pages-first state valid.
- Preview the complete bounded changeset once.
- Apply/resume with the same token and outer idempotency key until terminal.
- Continue only from `in_progress`; success is `committed` with authoritative readback for every changed step.
- Stop on `failed_before_commit`, `partial_commit`, or `manual_recovery`. Re-read and re-plan; never assume rollback.
- Remove a recovery journal through the destructive resolution ability only after explicit human approval; journal removal does not roll back data.

Split work above 25 resources into independently valid batches. For renames or reference migrations, use dependency hints to narrow authoritative consumer reads; hints are not proof that a resource is unused.

## Boundaries

- Rendered HTML is verification evidence, not editable source.
- Page files may reference but cannot mutate shared design resources.
- Workspaces update existing resources. Use focused create/delete abilities and their safety envelopes for lifecycle changes.
- Never replace focused ownership/version/digest requirements with a repository baseline.
- Do not reconstruct redacted component or code-sensitive data from frontend markup.
- Prefer a fresh targeted checkout over retaining a large snapshot across unrelated tasks.
