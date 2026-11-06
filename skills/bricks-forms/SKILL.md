---
name: bricks-forms
description: "Build or debug Bricks form fields, actions, validation, integrations and submissions without losing existing configuration."
---

**Requires:** Bricks 2.4+ with the Abilities API enabled

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

## Agency field notes

Deltas carried from the agency fork (vendor 0.1.3 does not contain them). Upstream these rather than editing the sections above.

Forms are the single most-failed-silently feature in Bricks. The form submits, the user sees "thank you", and no email ever arrives. Use it for the Form element surface, the action pipeline, the submissions database, and the debugging order when things do not work.

### The 18 field types

| `checkbox` | Multi-select or single consent box | `options` (comma-separated values), `value` for default |

### `{{field-id}}` vs `{{field-name}}` templating

After field placeholders are replaced, Bricks renders normal dynamic data such as `{post_title}` or `{site_title}` in subject, body, redirect URL, and webhook content. `admin_email` is an email-recipient option, not a `{admin_email}` dynamic-data tag.
**Common trap:** templating doesn't HTML-escape. If a form captures `<script>`, that goes into the email body verbatim. Add your own `esc_html()` in a `bricks/form/response` filter if submissions are forwarded somewhere that renders HTML.

### Anti-spam: reCAPTCHA, hCaptcha, Turnstile, honeypot

| reCAPTCHA v2 (checkbox) | `Bricks > Settings > API keys` + per-form enable | User-visible. Loads Google's JS. |
| hCaptcha / Turnstile | Same settings page (different key fields) | Drop-in alternative to reCAPTCHA. Turnstile is faster globally. |
**reCAPTCHA silent-failure:** if keys are set globally but the form element doesn't have "Enable reCAPTCHA" on, it validates but doesn't block. The toggle lives in the form element's settings, not just the global settings.

### SMTP: why emails silently drop

Bricks uses WordPress's `wp_mail()`. Shared hosts drop outgoing mail from `wp_mail()` daily. The form success-state is "mail was handed off to PHP": not "mail was delivered."
4. If submissions save but emails don't arrive, SMTP is the cause 90% of the time. Bricks is fine.
**Debug hook:** log `bricks/form/response` to see what Bricks returned to the browser. If `action: email, type: success` is in there, Bricks told PHP to send. Anything else is SMTP.

### Silent-failure debug order

When a form "doesn't work", walk these in order. The first one matches 70% of the time.
5. **reCAPTCHA always fails?** Keys mismatched (v2 keys in v3 fields or vice versa), or the domain isn't whitelisted in the reCAPTCHA admin.

### Never do

- Hard-code API keys (Mailchimp / SendGrid) anywhere except `Bricks > Settings > API keys`. They get stored encrypted there; stored elsewhere they leak in revisions.

## Academy reference

For form creation and management:
- **Forms**: https://academy.bricksbuilder.io/chapters/elements/#forms
- **Form Fields**: https://academy.bricksbuilder.io/chapters/elements/#form-fields
- **Form Validation**: https://academy.bricksbuilder.io/chapters/elements/#validation
- **Form Submission**: https://academy.bricksbuilder.io/chapters/elements/#submission
- **reCAPTCHA**: https://academy.bricksbuilder.io/chapters/elements/#recaptcha
