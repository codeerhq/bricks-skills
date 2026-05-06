---
name: forms
description: "Use when building or debugging Bricks forms: \"add a contact form\", \"hook my form to a webhook\", \"why isn't my form emailing?\", \"add a reCAPTCHA\", \"save submissions to the database\". Covers 18 field types, up to 14 action types, submissions table, anti-spam, and the silent-failure modes production forms always hit."
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

# Bricks: forms

Forms are the single most-failed-silently feature in Bricks. The form submits, the user sees "thank you", and no email ever arrives. Use it for the Form element surface, the action pipeline, the submissions database, and the debugging order when things do not work.

## The 18 field types

Defined at `includes/elements/form.php:179-198`. Stored in `settings.fields[]` as a repeater array. Each entry has `type` + type-specific keys.

| Type | Purpose | Key config keys |
|---|---|---|
| `email` | Email input | `label`, `placeholder`, `required`, `minLength`, `maxLength`, `pattern` |
| `text` | Single-line text | `label`, `placeholder`, `required`, `minLength`, `maxLength`, `pattern`, `autocomplete` |
| `textarea` | Multi-line text | `label`, `placeholder`, `required`, `minLength`, `maxLength` |
| `richtext` | TinyMCE editor | `label`, `required`, `tinyMceShowMenuBar` |
| `tel` | Phone | Same as text, `autocomplete: tel` common |
| `number` | Numeric | `min`, `max`, `step` |
| `url` | URL | Pattern-validated by browser |
| `image` | Single image from media library | Requires logged-in user by default |
| `gallery` | Multiple images | Same as image, array result |
| `checkbox` | Multi-select or single consent box | `options` (comma-separated values), `value` for default |
| `select` | Dropdown | `options`, `valueLabelOptions` if value != label |
| `radio` | Single-select group | `options`, `value` |
| `file` | File upload | `fileUploadAllowedTypes`, `fileUploadStorage` (media library / uploads folder), `fileUploadStorageDirectory` |
| `datepicker` | Flatpickr widget | `time` (boolean for time picker), DB format configurable |
| `password` | Password | `passwordToggle` adds show/hide icon |
| `rememberme` | "Stay signed in" checkbox | Only meaningful when Form is used for login |
| `html` | Static HTML injected between fields | No submit value; for section headings, consent copy, etc. |
| `hidden` | Hidden input | For honeypot (`isHoneypot`), dynamic-data value injection |

**Honeypot field**: set any field's `isHoneypot` to true. Must be `hidden` type in practice. Value stays empty via CSS; bots that autofill get rejected server-side via `bricks/element/form/honeypot/result`. Cheap and works.

**Field `id` key**: unique per field in the repeater. Bricks email/webhook placeholders use the bare field id: `{{abc123}}`. For file fields, `{{abc123:url}}`, `{{abc123:name}}`, `{{abc123:type}}`, `{{abc123:size}}`, and `{{abc123:id}}` read file properties.

**Field `name` attribute**: the `name` key controls the submitted HTML input name. Bricks maps custom names back to `form-field-{id}` internally, so email/webhook placeholders still use the field id, not the custom name. Placeholder matching uses word characters only (`A-Z`, `a-z`, `0-9`, `_`), so avoid relying on hyphenated placeholder names.

## The action pipeline

Actions run **in order** on submit, except `redirect`, which Bricks moves to the end before running actions (`includes/integrations/form/init.php:429-438`). Each built-in action is a class in `includes/integrations/form/actions/*.php` implementing `run()`. The current source lists 12 base actions in `includes/integrations/form/init.php::get_available_actions()`, plus `unlock-password-protection` when password protection is enabled and `save-submission` when form submissions are enabled.

| Action | What it does | Required settings |
|---|---|---|
| `email` | Sends email to admin. Can also send confirmation email when its confirmation settings are enabled. | Recipient, subject, body (supports `{{field_id}}` templating) |
| `webhook` | POSTs JSON to a URL | Webhook URL, body template |
| `redirect` | Server-side redirect on success | Target URL (supports dynamic data) |
| `custom` | Runs the built-in Custom action class, which fires `bricks/form/custom_action` | Your PHP callback handles it |
| `login` | Logs user in | Username/email + password field IDs, remember field ID (optional) |
| `registration` | Creates a WP user | Email + password fields, role setting |
| `lost-password` | Triggers password-reset email | Email field |
| `reset-password` | Completes password reset | Email + password + password-confirm fields |
| `create-post` | Creates a WP post | Post type, title field, content field, meta-key mappings |
| `update-post` | Updates an existing post | Post ID field (often hidden + dynamic), same mappings |
| `save-submission` | Saves to `bricks_form_submissions` table | Appears only when `Bricks > Settings > Form > Save submissions` is enabled; MCP setting writes create the table lazily if needed |
| `unlock-password-protection` | Unlocks the Bricks password-protection gate | Password field; appears when `passwordProtectionEnabled` is active |
| `mailchimp` | Adds subscriber to a Mailchimp list | Mailchimp API key (global setting), list ID, email field |
| `sendgrid` | Adds contact to SendGrid | SendGrid API key, list ID, email field |

**Order matters.** Bricks runs actions in the stored order after moving `redirect` to the end. If an action reports an error, processing stops through `maybe_stop_processing()`, so place validation-style custom actions before side-effect actions.

**Custom action registration:**

```php
add_action( 'bricks/form/action/my_action_key', function( $form ) {
    // Access fields
    $fields = $form->get_fields();
    $email = $fields['form-field-abc'] ?? '';
    // Access form settings
    $settings = $form->get_settings();
    // Set a failure message (shown to user)
    if ( ! $email ) {
        $form->set_result( [
            'action'  => 'my_action_key',
            'type'    => 'danger',
            'message' => 'Email is required.',
        ] );
        return;
    }
    // Success path: no set_result needed, success is default
} );
```

Then add `my_action_key` to the form's action list via the builder or `bricks/update-form-actions` MCP ability. The MCP write accepts custom action keys only when the matching `bricks/form/action/{key}` hook is already registered on the site.

For the built-in `custom` action, hook `bricks/form/custom_action` instead. For your own action keys, Bricks checks `has_action( "bricks/form/action/{$form_action}" )` and then fires that dynamic hook (`includes/integrations/form/init.php:439-466`). The form instance exposes getters such as `get_fields()`, `get_settings()`, `get_uploaded_files()`, `get_id()`, `get_post_id()`, and `set_result()` (`includes/integrations/form/init.php:571-596`).

## `{{field-id}}` vs `{{field-name}}` templating

Use the submitted field id in double braces:

- `{{abc123}}`: value for field id `abc123`
- `{{abc123:url}}`: URL property for an uploaded file field
- `{{all_fields}}`: all submitted fields in email content
- `{{referrer_url}}`: submitted referrer URL, undocumented but handled by source

After field placeholders are replaced, Bricks renders normal dynamic data such as `{post_title}` or `{site_title}` in subject, body, redirect URL, and webhook content. `admin_email` is an email-recipient option, not a `{admin_email}` dynamic-data tag.

**Common trap:** templating doesn't HTML-escape. If a form captures `<script>`, that goes into the email body verbatim. Add your own `esc_html()` in a `bricks/form/response` filter if submissions are forwarded somewhere that renders HTML.

## Submissions: the database toggle

Two conditions both required before submissions save:

1. `Bricks > Settings > Form > Save submissions` = **On** (site-level toggle, `saveFormSubmissions` in `Database::get_setting`).
2. The `save-submission` action is added to the form's action list.

Storage: custom table `{prefix}bricks_form_submissions` (`includes/integrations/form/submission-database.php:11-93`). Columns: `id, post_id, form_id, created_at, form_data (LONGTEXT JSON), browser, ip, os, referrer, user_id, status, favorite, info`.

- `form_id` = the Form element's `_id` (not a post id).
- `form_data` = JSON blob of all submitted fields keyed by field id.
- `status` defaults to `unread`.

**The `post_id` column is the page the form lived on at submit time**, not the post-type value for `create-post` actions. Don't confuse these.

Reading submissions from code:

```php
global $wpdb;
$rows = $wpdb->get_results( $wpdb->prepare(
    "SELECT * FROM {$wpdb->prefix}bricks_form_submissions WHERE form_id = %s ORDER BY created_at DESC LIMIT 50",
    $form_element_id
) );
```

Browse in UI: `WP Admin > Bricks > Form submissions`: visible only when the setting is on.

## Anti-spam: reCAPTCHA, hCaptcha, Turnstile, honeypot

Four anti-spam mechanisms, not mutually exclusive. Combine for production.

| Mechanism | Where configured | Gotcha |
|---|---|---|
| Honeypot field | Per form, `isHoneypot` on a hidden field | Free, works against dumb bots. Trivial to bypass for targeted scrapers. |
| reCAPTCHA v2 (checkbox) | `Bricks > Settings > API keys` + per-form enable | User-visible. Loads Google's JS. |
| reCAPTCHA v3 (invisible) | Same settings page | Score-based. Threshold tunable via `bricks/form/recaptcha_score_threshold` filter (default 0.5). |
| hCaptcha / Turnstile | Same settings page (different key fields) | Drop-in alternative to reCAPTCHA. Turnstile is faster globally. |

**reCAPTCHA silent-failure:** if keys are set globally but the form element doesn't have "Enable reCAPTCHA" on, it validates but doesn't block. The toggle lives in the form element's settings, not just the global settings.

## SMTP: why emails silently drop

Bricks uses WordPress's `wp_mail()`. Shared hosts drop outgoing mail from `wp_mail()` daily. The form success-state is "mail was handed off to PHP": not "mail was delivered."

**Fix order:**
1. Install a transactional SMTP plugin (WP Mail SMTP, FluentSMTP, Post SMTP). Configure Postmark / SendGrid / Amazon SES / Mailgun.
2. From address: use your domain, not `wordpress@example.com`. Shared hosts reject that.
3. Test with the SMTP plugin's "send test email" first: confirm SMTP works in isolation before blaming the form.
4. If submissions save but emails don't arrive, SMTP is the cause 90% of the time. Bricks is fine.

**Debug hook:** log `bricks/form/response` to see what Bricks returned to the browser. If `action: email, type: success` is in there, Bricks told PHP to send. Anything else is SMTP.

## Webhook action: the rate-limit trap

Webhooks POST to a configured URL as JSON or form-encoded data. With no custom data template, the payload is the submitted fields array, keyed by `form-field-{id}` plus any custom field names Bricks mapped during submit.

- Default timeout: 15 seconds. Filter with `bricks/webhook/timeout`.
- No built-in retry. If the endpoint returns an HTTP error or the request fails, the webhook action records an error unless the form has `webhookErrorIgnore` enabled (`includes/integrations/form/actions/webhook.php:202-239`). Log `bricks/form/response` or hook a custom action if you need more diagnostics.
- Without a custom data template, the payload starts as the submitted fields array (`form-field-{id}` keys, plus custom field names Bricks mapped back during submit) and adds uploaded-file metadata. With `contentType: json`, Bricks JSON-encodes that payload before sending.

```php
add_filter( 'bricks/webhook/timeout', function( $timeout ) {
    return $timeout;
} );
```

## Silent-failure debug order

When a form "doesn't work", walk these in order. The first one matches 70% of the time.

1. **Form didn't save?** Reload the builder, edit form, click Save. Un-saved builder state doesn't hit the frontend.
2. **Submission returned `success` but no email?** SMTP. Test via the SMTP plugin's test-send. (See SMTP section.)
3. **Submission returned error?** Check `bricks/form/response` or the browser Network tab. The response body names the failing action.
4. **`save-submission` enabled but nothing in the table?** Global `Save submissions` setting off, or `save-submission` action not added to the form.
5. **reCAPTCHA always fails?** Keys mismatched (v2 keys in v3 fields or vice versa), or the domain isn't whitelisted in the reCAPTCHA admin.
6. **Custom action not firing?** If the action key is `custom`, hook `bricks/form/custom_action`. If it is your own key, the form action must match the `bricks/form/action/{key}` hook suffix exactly. Typos silently drop.
7. **File upload "failed"?** `fileUploadAllowedTypes` too narrow, PHP `upload_max_filesize` / `post_max_size` too small, or upload dir not writable.
8. **Field `name` is empty in email?** Either `name` attribute unset on the field (auto-generated fallback doesn't match the email template), or the email template references a different field id.

## Never do

- Build a login flow with a Form element on a public site without rate-limiting. Bricks doesn't rate-limit login attempts. Add a plugin (Limit Login Attempts Reloaded) or bail to WP's standard login.
- Trust `saveFormSubmissions` alone: you still need the `save-submission` action added to each form you want persisted.
- Hard-code API keys (Mailchimp / SendGrid) anywhere except `Bricks > Settings > API keys`. They get stored encrypted there; stored elsewhere they leak in revisions.
- Put a password field in a form without also enabling HTTPS. Browsers warn users about non-HTTPS password forms; Bricks won't.
- Skip the `sanitize_*` step in a custom action that writes user input back anywhere. Bricks sanitizes for its own storage, not yours.

## Verification after editing a form

1. Check the builder preview: the form renders, all fields visible.
2. Submit a test from the frontend (not the builder). The builder is a preview context; submissions from inside it don't always process the full pipeline.
3. Watch `wp-content/debug.log` with `WP_DEBUG_LOG=true`: action failures log there.
4. Confirm the admin-side settings: `Bricks > Settings > API keys`, `Bricks > Settings > Form`.
5. If you have a submissions table, confirm one new row after a test submit.
