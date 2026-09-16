---
name: bricks-media-assets
description: "Find, upload or wire Bricks media, document downloads and custom icons; preserve shared assets and choose appropriate image loading."
---

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

Uploads are persistent WordPress attachments. If an upload was only for temporary testing, a discarded design direction, or a replacement that should not stay in the library, delete it only after verifying it was created for this task, is still unused and cleanup is within scope. Use `bricks/delete-media` with the returned `id` as `attachmentId`; retain pre-existing/shared attachments.

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
    "loading": "eager"
  }
}
```

Use the `sizes` object returned by `upload-media` to choose an appropriate `size` and URL. Choose the image size from its rendered dimensions and available variants. Do not lazy-load an above-the-fold LCP/hero image; use lazy loading for appropriate below-fold images.

## Documents and downloads

Use the native `file` element for a document link or download. Fetch its runtime
schema: `source` selects `file`, `external`, or `dynamic`, with different settings
for each. Put an uploaded attachment in its `file` control (`id` and `url`). Preserve the requested link/download behavior and verify it in
the frontend (`includes/elements/file.php`).

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

## Custom icons

For a custom SVG icon library, use `list-icon-sets` and `list-custom-icons` before
creating a set or uploading an icon. Inspect the live schemas for
`create-custom-icon-set` and `upload-custom-icon`, then wire the returned icon shape
through the target element's icon control. Server sanitization may change SVG data;
verify the resulting icon. Set deletion removes its icon rows but does not imply
attachment cleanup. Preserve other set entries and shared attachments.

Keep page-specific alternative text on the element when appropriate; changing
attachment metadata can affect its other uses.
