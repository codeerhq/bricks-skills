---
name: bricks-ai-tab
description: "Use when checking Bricks' AI screen: the master Bricks abilities toggle, per-ability disable list, direct-tool fast path, `bricks-list-ability-status`, and error codes when an ability is off."
---

**Requires:** Bricks 2.4+ with the Abilities API enabled

# Bricks: AI screen

Bricks exposes its abilities to MCP clients through `Bricks > AI`. This screen is the admin control panel for Bricks abilities. MCP clients cannot change these settings. The screen affects which Bricks abilities are callable.

## What the screen controls

1. **Enable Bricks abilities**: master toggle. Off means zero Bricks abilities register. Even diagnostic abilities such as `bricks-list-ability-status` are absent.
2. **Per-ability enable/disable**: registered abilities grouped by category. Most tools default on; security-sensitive groups can default off and require explicit opt-in. An unfiltered summary hides disabled rows by default. Request exact `abilityNames`, set `includeDisabled: true`, or use `responseFormat: "detailed"` to inspect them. Execution of a disabled ability returns `bricks_ability_disabled`.
3. **Adapter status**: informational. If the WordPress MCP Adapter plugin or the WordPress Abilities API is inactive, Bricks cannot expose abilities even with the toggle on.

## Direct tools vs dispatcher

Do not treat `tools/list` as the complete Bricks ability list.

Current Bricks source keeps only high-frequency abilities on the default MCP server as direct tools (`includes/abilities/manager.php`). The rest are enabled abilities but must be called through:

```
mcp-adapter-execute-ability
  ability_name: "bricks/<ability-name>"
  parameters: { ... }
```

So a missing direct tool can mean either:

- the ability is enabled but outside the fast path, or
- the admin disabled it, in which case dispatcher execution returns `bricks_ability_disabled`, or
- Bricks abilities are unavailable.

Check status before concluding the ability does not exist.

## The default model

The storage option `bricks_mcp_settings` is shaped:

```json
{
  "enabled": true,
  "disabledAbilities": [ "bricks/delete-post", "bricks/upload-media" ],
  "enabledAbilities": [ "bricks/list-builder-permissions" ]
}
```

`disabledAbilities` opts out of default-on abilities. `enabledAbilities` opts into default-off abilities. Permission-management tools are default off because they can change builder access for WordPress roles.

## Checking ability status

For a compact enabled inventory, call:

```
bricks-list-ability-status
```

For disabled-state diagnosis, use one of:

```
bricks-list-ability-status({ abilityNames: ["bricks/delete-global-class"] })
bricks-list-ability-status({ includeDisabled: true })
bricks-list-ability-status({ responseFormat: "detailed" })
```

Summary rows contain only `name`, `category`, `enabled`, and `defaultEnabled`.
Detailed rows additionally contain labels, descriptions, annotations, and the full
registry. Example compact response shape for the current ability surface (counts can
change as abilities are added or disabled):

```json
{
  "abilities": [
    { "name": "bricks/add-element", "enabled": true, "defaultEnabled": true, "category": "bricks-elements" }
  ],
  "total": 164,
  "enabled": 163,
  "disabled": 1
}
```

If `enabled: false`, a site admin either disabled the ability or has not opted into a default-off group. You cannot route around it. The fix is for a human to enable it under `Bricks > AI`.

Also call:

```
bricks-get-mcp-version
```

Selected response fields (the runtime may return additional counters):

```json
{
  "bricksVersion": "2.4.0",
  "bricksAbilitiesVersion": "2.0.0",
  "adapterVersion": null,
  "wordpressVersion": "6.8",
  "abilitiesApiActive": true,
  "disabledAbilityCount": 1
}
```

There is no `abilityCount` field in `get-mcp-version`; use `list-ability-status.total` when you need the count.

## Error codes you'll see

- **`bricks_ability_disabled`**: the dispatcher or a diagnostic path reached an ability name that the admin disabled. Do not retry. Call `bricks-list-ability-status` to confirm state.
- **Master toggle off**: no dedicated error code. With Bricks MCP disabled, no `bricks/*` abilities register at all. Tell the user to enable Bricks abilities under `Bricks > AI`.
- **`bricks_setting_excluded`** / **`bricks_setting_unknown`**: these come from the settings registry, not the AI screen. See the `bricks-settings` skill.

## How the screen interacts with call-time checks

The AI screen is an exposure deny-list, not a role editor:

- An enabled ability can still fail at call time. Use the returned error to decide what to do next.
- A disabled ability registers as an inspectable shim. The caller cannot bypass the deny-list by using the dispatcher; execution returns `bricks_ability_disabled`.

## What's not in the tab

These are not toggleable by MCP and should stay human-admin tasks:

- **License activation**: admin UI only.
- **Credential/API settings**: keys matching `apiKey*`, `apiSecretKey*`, or `license*`, plus access tokens and template passwords, are excluded from Bricks settings abilities. Use `bricks-list-credential-status` to check whether a credential is configured without reading its value. Other provider settings, such as `adobeFontsProjectId`, are only writable if `bricks/list-settings-schema` exposes them.
- **Code-execution settings**: `executeCodeEnabled`, `executeCodeCapabilities`, `codeSignaturesLocked`, `codeExecutionMode`, and `htmlExecutionMode` are excluded from Bricks settings abilities (`includes/abilities/settings.php`).
- **Code-signature regeneration**: admin UI only.

If a task requires one of these, surface the requirement to a human. Do not try to find another MCP route.

## Typical flow: an expected ability is missing

```
# Expected bricks/delete-global-class but it is not in tools/list.

bricks-list-ability-status({ abilityNames: ["bricks/delete-global-class"] })
  -> { abilities: [{ name: "bricks/delete-global-class", enabled: false, category: "bricks-design" }], ... }

# Admin disabled it. Tell the user:
# "The site owner has disabled delete-global-class on this Bricks install.
#  Re-enable it under Bricks > AI."
```

## Don't

- Don't assume tool availability is stable across sites. Check `list-ability-status` when an expected ability is missing.
- Don't retry on `bricks_ability_disabled`. The deny-list is explicit.
- Don't bypass the AI screen by editing `bricks_mcp_settings` directly. The UI is the contract.
- Don't assume a missing `tools/list` entry means the ability is disabled. Many enabled Bricks abilities are dispatcher-only.
