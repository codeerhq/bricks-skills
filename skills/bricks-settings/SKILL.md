---
name: bricks-settings
description: "Use when reading or changing Bricks global settings (post types, CSS loading, maintenance mode, performance toggles). Covers the allow-list registry flow, partial-merge semantics, and what keys are excluded from MCP by design."
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

# Bricks: global settings (via MCP)

Bricks global settings (the `bricks_global_settings` option: hundreds of keys backing the admin Settings pages) are exposed to MCP through an **allow-list registry**. You don't `update_option` the whole blob: you discover writable keys, then send partial writes that update the keys you send.

Three tools. Use them in order:

1. **`bricks/list-settings-schema`**: read-only discovery. Returns every key the MCP will accept, with type, category, description, and validation hints. Call this first if you don't already know which key to write.
2. **`bricks/get-global-settings`**: read current values for keys in the registry. Never returns excluded credential values or code-execution toggles.
3. **`bricks/set-global-settings`**: partial-merge write. Takes `{ settings: { key: value, ... } }`. Other keys untouched.

## Partial-merge semantics

`set-global-settings` updates the keys you send and leaves everything else alone. This is the opposite of a typical `update_option` call: you don't need to round-trip the entire settings blob. Safe to batch multiple unrelated top-level keys in one call.

```
bricks/set-global-settings
  settings:
    postTypes: ["page","post","product","bricks_template"]
    cssLoading: "file"
```

Result: `postTypes` and `cssLoading` updated; every other setting (maintenance mode, disable emojis, etc.) retained exactly as it was.

## What the registry contains

Dozens of keys across categories. Current examples from `includes/abilities/settings.php`:

- **general**: `postTypes`, `wp_to_bricks`, `bricks_to_wp`, `disableClassManager`, `disableVariablesManager`, `disableOpenGraph`, `disableSeo`, `elementAttsAsNeeded`, `customImageSizes`, `disableSkipLinks`, `smoothScroll`, `deleteBricksData`, `searchResultsQueryBricksData`, `themeStylesLoadingMethod`, `duplicateContent`, `enableQueryFilters`
- **templates/forms**: `publicTemplates`, `myTemplatesAccess`, `myTemplatesWhitelist`, `remoteTemplates`, `saveFormSubmissions`
- **builder/MCP**: `builderAutosaveInterval`, `builderQueryMaxResults`, `builderLocale`, `abilitiesApi`
- **performance toggles**: `cssLoading`, `disableBricksCascadeLayer`, `disableEmojis`, `disableJqueryMigrate`
- **bricks-maintenance**: `maintenanceMode`, `maintenanceTemplate`, `bypassMaintenanceUserRoles`, `maintenanceExcludedPosts`
- **password protection**: `passwordProtectionEnabled`

Call `list-settings-schema` to see the current full list: it's auto-generated from the registry and stays in sync with Bricks updates.

## What's EXCLUDED (by design: not writable via MCP)

These are blocked at the registry level (see `Settings::EXCLUDED_SETTING_KEYS`). Attempting `set-global-settings` with any of these returns `bricks_setting_excluded`. The literal list:

- `licenseKey`: plus any key starting with `license`, `apiKey`, or `apiSecretKey`
- `instagramAccessToken`
- `myTemplatesPassword`
- `remoteTemplatesPassword`
- `remoteTemplates[].password`
- `executeCodeEnabled`: master toggle for the custom-PHP execution path
- `executeCodeCapabilities`: role matrix controlling who can execute code
- `codeSignaturesLocked`: prevents tampering with the signature-verification defense
- `codeExecutionMode`: chooses between strict and permissive PHP sandboxing
- `htmlExecutionMode`: same, for custom HTML blocks

Reason: every item here is a credential or privilege-escalation boundary. A tool that can read `apiKeyGoogleMaps` can leak a billable provider key; a tool that can flip `executeCodeCapabilities` or `executeCodeEnabled` can grant itself RCE. These values stay admin-UI-only even with MCP fully enabled. Signature regeneration is also admin-UI-only and is not controlled by an excluded settings key: it simply has no MCP ability (see the `bricks-maintenance` skill).

If a task requires one of these, surface the requirement to a human: don't try to route around the exclusion.

`remoteTemplates` can manage saved source URLs and optional names only. Passwords are preserved if already configured, but never returned or written. New MCP-written remote template URLs must be public `http`/`https` URLs: private, loopback, link-local, unsafe-port, credentialed, or non-resolving hosts are rejected because those URLs are later used for outbound template-library fetches.

## Credential status

Use `bricks-list-credential-status` when you only need to know whether a credential exists. It returns rows with `configured`, `readable: false`, and `writable: false`; it never returns the stored value or a masked fragment.

Good uses:

- Map work: check `apiKeyGoogleMaps.configured` before building a Google Maps experience.
- Form spam protection: check the matching site key and secret key before enabling reCAPTCHA, hCaptcha, or Turnstile.
- Integrations: check Mailchimp, SendGrid, Instagram, and template-library credentials before assuming the integration can run.

Do not ask for the raw value. If a required credential is missing, tell the user which setting to add in the Bricks admin UI.

## Unknown-key handling

`set-global-settings { settings: { fooBarBaz: 1 } }` where `fooBarBaz` isn't in the registry returns `bricks_setting_unknown`. This is defensive: silent acceptance of arbitrary keys would make the option bloat with junk an admin can't clean up.

If you think a setting SHOULD be writable but isn't in the registry, it probably moved to a dedicated ability:

- Breakpoints -> `bricks/set-breakpoints`
- Style manager -> `bricks/set-style-manager`
- Pseudo-classes -> `bricks/set-pseudo-classes`
- Element enable/disable -> element-manager abilities
- Icon libraries -> icons abilities
- Builder role access -> `bricks/list-builder-permissions`, `bricks/upsert-builder-capability`, `bricks/set-builder-role-access`

The registry is for keys that don't fit into one of those domains.

## Tool availability

> **If a `bricks/*` ability is not available as a direct tool**: first check whether it is outside the fast path and call it through `mcp-adapter-execute-ability` with `ability_name: "bricks/<name>"`. If the dispatcher also rejects it, call `bricks-list-ability-status` to check whether a site admin disabled it under Bricks > AI.

## Typical flow

```
bricks/list-settings-schema
  -> scan output for "maintenance" category
  -> find maintenanceMode, maintenanceTemplate, bypassMaintenanceUserRoles, maintenanceExcludedPosts

bricks/get-global-settings (optional: check current values)

bricks/set-global-settings
  settings:
    maintenanceMode: "maintenance"
    maintenanceTemplate: 123
    bypassMaintenanceUserRoles: "custom"
    maintenanceExcludedPosts: ["45","88"]
```

One call, four keys, atomic update. Everything else about the site untouched.

## Don't

- Don't write settings by calling `bricks/get-global-settings` -> mutating -> `bricks/set-global-settings` with the whole blob. It works, but it defeats partial-merge and races with admin UI saves.
- Don't retry on `bricks_setting_excluded`: the exclusion is permanent and deliberate.
- Don't treat `list-settings-schema` output as cacheable across Bricks versions: new keys show up with updates.
