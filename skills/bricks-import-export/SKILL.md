---
name: bricks-import-export
description: "Use when moving Bricks data between sites with the unified import/export MCP abilities. Covers transfer-package listing, export, inspect, import, conflict handling, sensitive settings, and site-to-site package migration."
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

# Bricks: unified import / export via MCP

The MCP flow mirrors the Bricks UI import/export package, not the older separate global-data JSON and template ZIP flows.

Use these abilities:

- `bricks/list-transfer-items`: read the current site's export selector and exact item IDs.
- `bricks/export-transfer-package`: create a base64 ZIP package from explicit selected item IDs.
- `bricks/inspect-transfer-package`: inspect a ZIP before import; returns conflicts, warnings, and `zipHash`.
- `bricks/import-transfer-package`: import selected manifest items. Requires `expectedZipHash` from inspection.

Supported transfer types: `color-palettes`, `theme-styles`, `classes`, `variables`, `custom-fonts`, `breakpoints`, `global-queries`, `components`, `templates`, `settings`, `custom-capabilities`.

## Normal site-to-site flow

1. On the source site, call `bricks/list-transfer-items`.
2. Choose explicit item IDs from the response.
3. Call `bricks/export-transfer-package` with:

```json
{
  "types": ["classes", "components", "templates"],
  "items": {
    "classes": ["abc123"],
    "components": ["hero-card"],
    "templates": ["100", "101"]
  }
}
```

4. On the target site, call `bricks/inspect-transfer-package` with the returned `zipBase64`.
5. Review `manifest.types.*.items`, especially `conflict` and `warning`.
6. Call `bricks/import-transfer-package` with the same `zipBase64`, the inspected `zipHash` as `expectedZipHash`, and explicit manifest item IDs:

```json
{
  "zipBase64": "UEsDBBQ...",
  "expectedZipHash": "sha256-from-inspect",
  "types": ["classes", "components"],
  "items": {
    "classes": ["abc123"],
    "components": ["hero-card"]
  },
  "conflictMode": "skip"
}
```

## Safety rules

- Always inspect before import. The import ability requires `expectedZipHash` so the imported ZIP matches the package you reviewed.
- `conflictMode` defaults to `skip`. Use `replace` only when overwriting is requested, and pass `allowOverwrite: true`.
- Per-item replacements live in `conflictDecisions`, keyed by type and item ID; any `replace` value also requires `allowOverwrite: true`.
- Sensitive settings tabs (`api-keys`, `custom-code`) require `allowSensitiveSettings: true` on export or import.
- Template image import is off by default. Use `importImages: true` only when media migration is intended and the user can upload files.
- MCP ZIP payloads are capped for JSON transport. If a package is too large, split by type or item selection.
- Code-bearing components/templates require the Bricks execute-code capability. Exports are redacted for users without that capability; imports containing executable payloads are rejected for that user.

## Notes

- `items` is required for each selected type. Do not omit it and assume "everything".
- For singleton `breakpoints`, use `items: { "breakpoints": ["all"] }`.
- For settings, pass tab IDs such as `builder`, `performance`, `api-keys`, or `custom-code`.
- Transfer packages include `manifest.json`; template-only legacy ZIPs without a manifest are not accepted by the unified import flow.

## Tool availability

If a `bricks/*` ability is not available as a direct tool, first check whether it is outside the fast path and call it through `mcp-adapter-execute-ability` with `ability_name: "bricks/<name>"`. If the dispatcher also rejects it, call `bricks-list-ability-status` to check whether a site admin disabled it under Bricks > AI.

## Don't

- Don't call the legacy `bricks/export-global-data`, `bricks/import-global-data`, `bricks/export-templates`, or `bricks/import-template-bundle` flow for unified package migration.
- Don't import without inspecting and passing `expectedZipHash`.
- Don't use `replace` or per-item replacement decisions without clear user intent.
- Don't export or import sensitive settings tabs unless the user explicitly asked for them.
- Don't assume media migration happens unless `importImages: true` is passed.
