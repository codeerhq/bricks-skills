---
name: bricks-site-versions
description: Use when the user wants private page drafts, named site versions, independent copy or design alternatives, comparison, client review links, or publication of saved private work in Bricks.
---

# Bricks site versions

Ordinary Bricks write abilities still edit the live site. A private Builder URL
does not make those abilities private. Use the explicit authoring abilities and
the context returned by the current site.

## Choose the work

- For one existing page or template, use `bricks/get-page-draft` or explicitly create
  work with `bricks/begin-page-draft`.
- For coordinated page, template and global changes, use a named site version.
  `bricks/create-site-version` starts from live data; `bricks/fork-site-version` preserves an
  existing private design and its original live merge baseline.
- Reuse requested work by its exact identity. Creating another version is not a
  recovery method after an uncertain response.

For a new page or template inside private work, use `bricks/create-authoring-post`;
use `bricks/duplicate-authoring-post` to copy an existing subject. Keep the returned
real native ID and context. Creating from a page draft opens the new subject's own
draft; creating in a named version keeps it in that version.

Use `bricks/import-authoring-templates` for local template packages in private
work. For remote insertion, use the advertised context-aware
`bricks/insert-remote-template` operation and a configured source. Preserve returned
local IDs, context and opaque preparation evidence. Do not invent remote linkage
or merge imported dependencies into live globals. A batch advances through its
returned contexts; an uncertain batch response still needs the original request,
not a reconstructed request against its latest partial result.

Read the advertised schema for each specific action named in this workflow once,
then reuse it. A full ability-catalog discovery is unnecessary when those actions
are available; use catalog discovery only to locate an unknown or missing
capability. When a tool wrapper contains both text and the same structured result,
inspect one result rather than echoing the entire duplicate envelope.

Missing abilities may indicate an older site or disabled AI actions. Do not
replace a missing private operation with a live write, direct WordPress metadata
update or another persistence mechanism.

## Read only what the edit needs

Use `bricks/inspect-authoring-work` with narrow document, resource and control targets.
It returns native IDs and guards without requiring complete document downloads.
Use `bricks/get-authoring-document` when structural changes need the full native tree.
Preserve existing element IDs, opaque fields and explicit subtree removal intent.
Native control states use a nonempty registered breakpoint key for the selected
target and source, such as `desktop`; empty pseudo and variant values are normal.
A live breakpoint listing does not replace a private source's pinned definitions.

`bricks/apply-authoring-work` accepts the advertised guarded edits or native documents
and saves them privately. Include required read dependencies. Do not invent
ownership, schema or before-digests, and do not refresh a stale guard merely to
overwrite another editor's work.

## Present independent choices

Use `bricks/get-authoring-options`, then `bricks/set-authoring-options` for labeled groups such
as Copy, Background and Typography. Groups describe decisions, not whole-page
screenshots. Different controls on the same element can be independent; declare
actual dependencies and resolve overlapping edits explicitly.

Read control shapes once, keep native after-values server-side, and reuse saved
choice/revision handles. `bricks/preview-authoring-options` returns an authenticated
working-design `previewUrl` and compact context, catalog and selection handles.
Present that returned URL directly; it needs the viewer's current private access
and is not a public sharing link. Do not repeat catalog discovery to find a
renderer or reconstruct the returned link. Pass the handles directly to
`bricks/apply-authoring-options` after the user selects an option. A second preview
or a full control/document echo is unnecessary.
“As saved” makes no change. Human switching and side-by-side comparison require
no further model calls.

Apply changes the private working design. It does not publish. The working
preview is also distinct from a publication review that incorporates newer
live changes.

## Review, share and publish

Prepare publication through the advertised publication abilities and inspect its
exact result and affected shared resources. Review the merged result against
current live data; do not assume the private working preview is that result.
Resolve reported conflicts and obtain a new review when its inputs have changed.

Shared classes and components retain their shared identity on publication.
Duplicate or detach only when the user requests a local alternative.

Create a review link only when the user asks to share. Use the sharing guard,
explicit expiry and exact prepared result required by the live schema. An
authenticated working preview is not a client link. Client option exploration
does not grant Apply or Publish permission.

Use Publish only within the user's authorization. Submit its exact reviewed
identity. A stale publication must return to review, not silently recompute and
publish a different result.

After Publish, ongoing work starts clean from the applied result, including
preserved newer live changes. Use the returned authorized current context or
read the version again before the next edit. Keep the original context only
for retrying that original Publish. Copy a version explicitly when another
ongoing idea should keep its own identity.

## Uncertain responses and history

Keep the entire original mutation request and its stable idempotency key. Retry
that identical request until its outcome is known. A successful replay describes
the original operation, not necessarily the latest current head; inspect fresh
state before starting another action.

Discarding a page draft requires an explicit user request and the exact visible
head through `bricks/discard-page-draft`. It leaves the published page intact. An old
Discard retry must not be replaced with a new request targeting newer work.

Archive keeps a named version and its history available for later restoration.
Use `bricks/restore-site-version` with its current archived head to resume that
work. Restore does not renew an expired or revoked client review link. Delete
is a separate action and requires the user's explicit intent.

History is context-explicit. Use returned live or private guards for inspection
and Restore. Restore targets the selected item and preserves unrelated newer
items. Do not infer a missing or corrupted current value to be an empty list.
Current native, granular and Code permissions apply to historical data too.

## Sources

These contracts are defined in the Bricks source: `includes/abilities/authoring-work.php`,
`authoring-explore.php`, `authoring-publication.php`, `authoring-sharing.php`,
`authoring-history.php`, and `site-versions.php` under the same directory. The
architectural boundaries are recorded in `docs/engineering/site-versions.md`.
Runtime schemas take precedence over examples in this skill.
