---
name: import-export
description: "Use when moving Bricks content between sites: global-data JSON bundles or template ZIPs. Covers `bricks/export-global-data`, `bricks/import-global-data`, `bricks/export-templates`, `bricks/import-template-bundle`, bundle shape, merge vs replace, and base64-ZIP handling."
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

# Bricks: import / export (via MCP)

Two distinct flows (`includes/abilities/import-export.php`):

1. **Global-data bundle**: one object containing selected Bricks global options.
2. **Template bundle**: a base64-encoded ZIP containing one JSON file per Bricks template.

## Global-data bundle

### Shape

`bricks/export-global-data` returns:

```json
{
  "bundle": {
    "version": "2.x",
    "exportedAt": "2026-04-24T10:30:00+00:00",
    "site": "https://example.com",
    "globalClasses": [],
    "globalClassesCats": [],
    "colorPalette": [],
    "components": [],
    "breakpoints": [],
    "globalVariables": [],
    "globalVariablesCats": [],
    "themeStyles": [],
    "pseudoClasses": []
  },
  "counts": {
    "globalClasses": 47,
    "components": 12
  }
}
```

Allowed bundle keys are exactly:

`globalClasses`, `globalClassesCats`, `colorPalette`, `components`, `breakpoints`, `globalVariables`, `globalVariablesCats`, `themeStyles`, `pseudoClasses`.

There is no MCP bundle key for `iconSets` or `elementManager`.

In `merge` mode, row-shaped arrays de-dupe by `id` when present; scalar lists such as `pseudoClasses` are de-duped by value.

### Abilities

- **`bricks/export-global-data`**: body `{ include?: [ ... ] }`. Omit `include` for the full bundle. Returns `{ bundle, counts }`.
- **`bricks/import-global-data`**: body `{ bundle, mode?: "replace" | "merge" }`. Returns `{ success, imported, skipped, counts }`.

### Merge and replace

- `replace`: each included bundle key overwrites the corresponding option.
- `merge`: array rows are merged and de-duplicated by `id` when present. Rows without `id` are appended.

Unknown bundle keys are added to `skipped`; they are not imported.

### Version handling

The bundle contains `version: "2.x"`. If an import bundle includes `version`, the importer rejects values outside Bricks 2.x. Missing version is allowed for hand-crafted subsets. Do not use this as a migration tool between major Bricks data formats.

## Template bundle

### Shape

`bricks/export-templates` returns:

```json
{
  "filename": "templates-2026-04-24-103000.zip",
  "zipBase64": "UEsDBBQ...",
  "templateCount": 2
}
```

The ZIP contains one JSON file per template, the same basic format as the Bricks admin export. There is no `manifest.json` requirement in the template importer.

### Abilities

- **`bricks/export-templates`**: body `{ templateIds: [100, 101] }`. `templateIds` is required and must be non-empty.
- **`bricks/import-template-bundle`**: body `{ zipBase64: "..." }`. Returns `{ success, importedTemplates, skippedFiles }`.

The importer accepts JSON files in the ZIP root only. Entries with `..`, `/`, `\`, non-JSON extensions, malformed JSON, oversized JSON, or missing template content are added to `skippedFiles`.

Template ZIP imports are intentionally capped for MCP safety: decoded ZIP payloads must stay at or below 16 MB, archives may contain at most 50 files, and each decoded template JSON file may be at most 2 MB. If a real migration is larger than that, use the Bricks admin import flow or split the template bundle.

Images are not re-downloaded and asset folders are not imported by this MCP ability. Use the admin UI when importing a template bundle that depends on media from another site.

## Tool availability

> **If a `bricks/*` ability is not available as a direct tool**: first check whether it is outside the fast path and call it through `mcp-adapter-execute-ability` with `ability_name: "bricks/<name>"`. If the dispatcher also rejects it, call `bricks-list-ability-status` to check whether a site admin disabled it under Bricks > Settings > AI.

## Typical flow: clone design system from staging to prod

```
# On staging:
bricks/export-global-data
  -> { bundle: { version: "2.x", globalClasses: [...], components: [...] }, counts: {...} }

# On prod:
bricks/import-global-data
  bundle: <bundle>
  mode: "replace"
  -> { success: true, imported: ["globalClasses", "components"], skipped: [], counts: {...} }
```

License keys, API keys, and code-execution settings are not part of this global-data bundle. Code-bearing component/template payloads require the Bricks execute-code capability and may include their element signatures when exported by an allowed user.

If the current user does not have the Bricks execute-code capability, exported component/template element data is redacted where it contains executable Code, SVG code, query-editor PHP, or `{echo:...}` dynamic tags. Imports that contain those payloads are rejected for that user. Ask a human with the correct Bricks code-execution permission to review and import code-bearing bundles.

## Typical flow: move the homepage header + footer templates

```
bricks/list-templates { type: "header" }
bricks/list-templates { type: "footer" }
  -> [ { id: 100, title: "Primary Header" }, { id: 101, title: "Primary Footer" } ]

bricks/export-templates { templateIds: [100, 101] }
  -> { zipBase64: "UEsDBBQ...", filename: "templates-2026-04-24-103000.zip", templateCount: 2 }

bricks/import-template-bundle { zipBase64: "UEsDBBQ..." }
  -> { success: true, importedTemplates: [...], skippedFiles: [] }
```

## Don't

- Don't pass `keys`; current `export-global-data` uses `include`.
- Don't expect `iconSets`, `elementManager`, or settings credentials in the global-data bundle.
- Don't hand-roll a template ZIP with nested folders or a required manifest. The MCP importer reads JSON files from the ZIP root.
- Don't rely on `export-templates` with an empty `templateIds` array. It is a hard error.
- Don't assume media migration happens during MCP template import. Images are not re-downloaded.
