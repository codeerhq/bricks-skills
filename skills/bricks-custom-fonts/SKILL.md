---
name: bricks-custom-fonts
description: "Use when uploading or managing custom web fonts in Bricks: \"upload Inter.woff2\", \"add a weight to an existing font\", \"list installed fonts\". Covers the `bricks_fonts` CPT, font-face map, allowed formats, MIME enforcement, and the upload -> fontFaces flow."
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

# Bricks: custom fonts (via MCP)

Custom fonts in Bricks are three things bound together:

1. A `bricks_fonts` custom post type: one post per **font family**.
2. A `fontFaces` postmeta map on that family. Keys are weight/style strings such as `400`, `700`, or `400italic`.
3. Uploaded WP media attachments that store the actual font files.

The MCP abilities mirror that model (`includes/abilities/fonts.php`).

## Abilities

- **`bricks/list-custom-fonts`**: returns `{ fonts, total, page, perPage }`. Each row includes `id`, `family`, and `faceCount`.
- **`bricks/get-custom-font`**: body `{ fontId }`. Returns `{ font: { id, family, fontFaces } }`.
- **`bricks/create-custom-font`**: body `{ family }`. Creates the `bricks_fonts` post and returns `{ font }`. There is no `displayName` parameter.
- **`bricks/upload-custom-font-file`**: body `{ filename, content }`, where `content` is base64. Returns `{ attachmentId, url, format, bytes }`.
- **`bricks/update-custom-font`**: body `{ fontId, family?, fontFaces? }`. If `fontFaces` is provided, it replaces the whole font-face map.
- **`bricks/delete-custom-font`**: body `{ fontId }`. Deletes the font family post. It does not delete uploaded media attachments.

## Upload flow

Do not use `bricks/upload-media` for font files. The current font flow is:

```
bricks/upload-custom-font-file
  filename: "inter-regular.woff2"
  content: "<base64 bytes>"
  -> { attachmentId: 500, url: ".../inter-regular.woff2", format: "woff2", bytes: 42112 }

bricks/create-custom-font { family: "Inter" }
  -> { font: { id: 42, family: "Inter", fontFaces: {} } }

bricks/update-custom-font
  fontId: 42
  fontFaces:
    "400":
      - { woff2: 500 }
```

The upload ability stores the font file as a WP attachment. `update-custom-font` references those attachment IDs inside `fontFaces`.

**Enforced at upload time:**

- Extension allow-list: `woff2`, `woff`, `ttf`, `otf`, `eot`.
- MIME sniff via `wp_check_filetype_and_ext()`: extension alone is not trusted.
- Size limit: 8 MB decoded by default, filterable through `bricks/abilities/fonts/max_bytes`.

## `fontFaces` shape

```json
{
  "400": { "woff2": 500, "woff": 501 },
  "400italic": [
    { "woff2": 502, "unicode-range": "U+0000-00FF" },
    { "woff2": 503, "unicode-range": "U+0100-017F" }
  ],
  "700": { "woff2": 504 }
}
```

Rules:

- Keys are non-empty weight/style strings. Use `400`, `700`, `400italic`, etc.
- Each value may be one subset object or an array of subset objects. `validate_font_faces()` accepts both and normalizes a single subset back to an object (`includes/abilities/fonts.php:528`, `includes/abilities/fonts.php:571`).
- Format keys must be one of `woff2`, `woff`, `ttf`, `otf`, `eot`.
- Values are positive WP attachment IDs created by `bricks/upload-custom-font-file`.
- `unicode-range` is optional and lets multiple subsets share one weight/style variant.

## CSS output

Bricks generates `@font-face` rules from the `fontFaces` map and attachment URLs:

```css
@font-face {
  font-family: "Inter";
  font-weight: 400;
  font-style: normal;
  font-display: swap;
  src: url("/wp-content/uploads/.../inter-regular.woff2") format("woff2");
}
```

The family is then selectable in Bricks typography controls.

Frontend output currently emits `font-display: swap` in `includes/custom-fonts.php:304`. Bricks settings abilities do not expose a verified `customFontsDisplay` key, so do not claim font-display can be changed through MCP unless `bricks/list-settings-schema` shows that key on the target site.

## Tool availability

> **If a `bricks/*` ability is not available as a direct tool**: first check whether it is outside the fast path and call it through `mcp-adapter-execute-ability` with `ability_name: "bricks/<name>"`. If the dispatcher also rejects it, call `bricks-list-ability-status` to check whether a site admin disabled it under Bricks > AI.

## Adobe / Google fonts

Out of scope for this skill. Adobe Fonts uses the admin setting `adobeFontsProjectId`; Google Fonts can be disabled in the admin UI through `disableGoogleFonts`. Do not assume either is writable through MCP. Inspect `bricks/list-settings-schema` on the target site before changing provider settings.

## Don't

- Don't pass a URL or filesystem path as a face file. Upload base64 bytes with `bricks/upload-custom-font-file`.
- Don't send `displayName`, `id`, or `faces`; current schemas use `family`, `fontId`, and `fontFaces`.
- Don't update one face by sending a partial `fontFaces` object unless you intend to replace the whole map.
- Don't delete a family that's referenced by live typography controls without replacing the reference.
