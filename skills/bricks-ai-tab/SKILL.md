---
name: bricks-ai-tab
description: "Diagnose Bricks AI connection setup, ability toggles, dispatcher availability and disabled actions. Use for connection/availability problems."
---

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

`disabledAbilities` opts out of default-on abilities. `enabledAbilities` opts into default-off abilities. Permission-management tools are default off and control builder access for WordPress roles.

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

If `enabled: false`, a site admin either disabled the ability or has not opted into a default-off group. You cannot route around it. If enabling it is within the user’s authorized request, use the Bricks > AI admin UI when available; otherwise ask the site owner. A disabled ability cannot enable itself through MCP.

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

## PHP abilities

PHP is a separate opt-in, not a normal per-ability toggle. Bricks 2.4 uses
`BRICKS_ENABLE_PHP_ABILITIES`; the prerelease
`BRICKS_ENABLE_EXECUTE_PHP_ABILITY` name no longer enables it. An enabled master
switch or an administrator role alone is insufficient. See
[bricks-custom-code](../bricks-custom-code/SKILL.md#code-authoring-through-abilities)
for execution, signing, effective-capability, and Application Password prerequisites.
Do not enable PHP just to author ordinary CSS.

## What's not in the tab

These settings have no dedicated Bricks MCP write route. Use an authorized admin UI or configuration workflow if the user requested the change and that access is available; otherwise identify the prerequisite for the site owner:

- **License activation**: admin UI only.
- **Credential/API settings**: keys matching `apiKey*`, `apiSecretKey*`, or `license*`, plus access tokens and template passwords, are excluded from Bricks settings abilities. Use `bricks-list-credential-status` to check whether a credential is configured without reading its value. Other provider settings, such as `adobeFontsProjectId`, are only writable if `bricks/list-settings-schema` exposes them.
- **Code-execution settings**: `executeCodeEnabled`, `executeCodeCapabilities`, `codeSignaturesLocked`, `codeExecutionMode`, and `htmlExecutionMode` are excluded from Bricks settings abilities (`includes/abilities/settings.php`).
- **Code-signature regeneration**: admin UI only.

Do not treat permission to edit content as permission to change these settings. Preserve an explicit user authorization for a configuration change; do not ask them to repeat it merely because the work uses another available transport.

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
