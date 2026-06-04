# Common Bricks Element Patterns

Use this as a fast planning guide. Fetch exact schemas with `get-schema.mjs` or runtime MCP before writing complex settings.

## Core set

| Purpose | Prefer |
|---|---|
| Page band | `section` |
| Inner width/layout wrapper | `container` |
| Card or repeated layout item | `block` |
| Generic semantic wrapper | `div` |
| Headings | `heading` |
| Body copy | `text-basic` |
| Links and CTAs | `button`, `text-link` |
| Images | `image` |
| Icons | `icon` |
| Forms | `form` |
| Navigation | `nav-nested` |

## New builds

Start with layout primitives and global classes. Avoid reaching for specialized widgets unless they solve an actual editing or runtime problem.

Good default tree:

```json
[
  { "name": "section", "settings": { "tag": "section" }, "children": [
    { "name": "container", "children": [
      { "name": "heading", "settings": { "tag": "h1", "text": "Page title" } },
      { "name": "text-basic", "settings": { "tag": "p", "text": "Intro copy." } },
      { "name": "button", "settings": { "text": "Get started" } }
    ] }
  ] }
]
```

## Existing pages

If a page already uses a less common element, preserve that choice unless there is a good reason to replace it. Fetch that element's schema before editing it.

Examples:

- Existing `tabs-nested`: edit with the tabs schema, do not flatten to generic divs.
- Existing WooCommerce product elements: fetch the exact product element schema.
- Existing map/filter/social element: fetch its schema and keep plugin/integration requirements in mind.

## Converter-supported elements

The HTML-to-Bricks converter maps source HTML to this limited set:

`section`, `container`, `block`, `div`, `heading`, `text-basic`, `text-link`, `icon`, `button`, `image`, `svg`, `video`, `audio`, `code`, `divider`, `form`.

Unsupported source structures should be converted to a safe static shape first, then manually replaced with exact Bricks elements where needed.
