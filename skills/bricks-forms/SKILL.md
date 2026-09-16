---
name: bricks-forms
description: "Build or debug Bricks form fields, actions, validation, integrations and submissions without losing existing configuration."
---

# Bricks: forms

Use native form abilities for focused changes. Resolve the post and form element,
then `get-form-config` before editing an existing form. Read the runtime Form schema
for controls and action availability; optional features/plugins affect them.

## Choose the operation

| Change | Contract |
|---|---|
| Add, remove or reorder fields | `update-form-fields` replaces the entire ordered field array; merge the requested change into the full current array and preserve existing IDs |
| Change actions | `update-form-actions` replaces the supplied actions list and partially merges supported action settings; preserve unrelated actions and their order |
| New form | Native Form element with runtime-shaped fields/actions; no custom HTML form substitute |
| Diagnose submissions | `list-form-submissions` is paginated; missing storage does not prove the form never submitted |

Read [fields and actions](references/fields-and-actions.md) for supported field
shapes, action details, placeholder syntax, anti-spam or delivery troubleshooting.
Checkbox/select options are newline-separated. Email/webhook placeholders bind to
field IDs; keep them stable when changing labels or input names.

## Diagnose the actual failing stage

Separate rendering, client validation, server validation, action execution and
external delivery. A successful mail handoff does not prove delivery. Inspect the
configured transport/provider logs for the specific failure. Bricks credential UI
masking does not establish encrypted-at-rest storage; use supported configuration
and avoid copying secrets into page content or revisions.

## Verify within scope

A configuration review is read-only. A submission can send email/webhooks, create
users/posts or cause payment-related effects. For requested functional testing, use
an authorized test destination/fixture and check the intended action result. Do not
submit a production form merely to inspect its layout.

Inspect mutation readback for the exact fields/actions, omissions and preserved
configuration; use `get-form-config` when that evidence is missing. Verify relevant
validation/error/success states and deferred CAPTCHA initialization in a browser
when available. Report absent browser or delivery evidence explicitly.
