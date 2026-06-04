---
name: bricks-media-assets
description: "Use when adding, replacing, finding, or wiring images, video, audio, galleries, or other WordPress media in Bricks. Covers upload-media, find-media, Image element settings, Gallery/Image Gallery usage, alt text, and avoiding external hotlinks."
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

# Bricks: media assets

Use WordPress media library attachments for assets that should live with the site. Do not hotlink production images from third-party URLs unless the user explicitly asks for remote assets.

## Lookup first

Before uploading, search existing media:

```json
{
  "query": "hero",
  "mimeType": "image/"
}
```

For broad searches, choose the compact response mode. Fetch full detail only when you need the exact generated size URLs for a chosen attachment. Use `bricks-find-media`. If the direct tool is missing, call `mcp-adapter-execute-ability` with `ability_name: "bricks/find-media"`.

## Upload

Prefer base64 uploads when the file is already local or generated:

```json
{
  "filename": "hero.jpg",
  "base64": "<base64 file data>",
  "title": "Homepage hero",
  "alt": "Person using the product dashboard"
}
```

Base64 uploads must use a filename with a WordPress-allowed media extension and stay within the site's configured upload-size limit. Use the dedicated custom-font abilities for font files.

URL sideloading is only for normal public `http`/`https` URLs. Do not use internal, localhost, private-network, link-local, metadata-service, unsafe-port, credentialed, or file URLs. Remote downloads are also checked against the site's configured upload-size limit.

Uploads are persistent WordPress attachments. If an upload was only for temporary testing, a discarded design direction, or a replacement that should not stay in the library, delete it with `bricks/delete-media` using the returned `id` as `attachmentId`.

## Image element settings

After upload, wire the returned attachment into an Image element:

```json
{
  "name": "image",
  "settings": {
    "image": {
      "id": 123,
      "url": "https://example.com/wp-content/uploads/hero.jpg",
      "filename": "hero.jpg",
      "size": "large",
      "full": "https://example.com/wp-content/uploads/hero.jpg"
    },
    "altText": "Person using the product dashboard",
    "loading": "lazy"
  }
}
```

Use the `sizes` object returned by `upload-media` to choose an appropriate `size` and URL. Hero images usually use `large` or `full`; cards and thumbnails should use smaller generated sizes.

## Galleries

For a native gallery, fetch the `image-gallery` schema before writing. Gallery controls differ from a single Image element and should not be guessed.

If the page needs a carousel with arbitrary content, use `slider-nested` and add Image elements inside slides instead of forcing an Image Gallery.

## Accessibility

- Always set useful alt text for informative images.
- Use empty alt text only for decorative images.
- Keep captions as content only when they are visible and useful to the visitor.

## Site reproduction

When reproducing a page:

1. Download source images.
2. Upload each to the WordPress media library.
3. Replace external image URLs in Bricks Image elements with the returned attachment `id`, `url`, `filename`, and chosen `size`.
4. Verify rendered images use local WordPress URLs and include `srcset` where expected.

## Never do

- Do not leave scraped source-site image URLs in final Bricks elements.
- Do not use URL sideloading for private or local network addresses.
- Do not upload fonts with `upload-media`; use the custom-font abilities.
- Do not guess gallery schema. Fetch it first with `bricks-element-schemas`.
