---
name: bricks-html-css-to-bricks
description: "Use when importing or converting HTML/CSS into Bricks when the one-call page importer is unavailable, or when the task needs warning review, reusable resources, native-only output, CSS-only reconciliation, components, or manual Bricks wiring."
---

**Requires:** Bricks 2.4+ with the Abilities API enabled

# Bricks: HTML/CSS to Bricks

For a known empty page body, write semantic HTML/CSS and call `commit-html-css-page-import` once with one page identifier, complete `html` and `css`, `documentPurpose: "page-content"`, `replaceExisting: false`, and a new stable `idempotencyKey`. Import sibling page sections only: omit `<main>` because Bricks owns that landmark, and never embed a site-wide `<header>` or `<footer>` in a normal page. For the interior of an empty Bricks header/footer template, use `documentPurpose: "template-content"` and omit the automatic landmark. Do not call version, context, status, discovery, repository, changeset, the generic dispatcher, raw converter, or explicit preview first.

The ability checks the current design system, previews the conversion, saves it safely, and returns the persisted result. Exact retries reuse the same key.

If the result has `autoApplied: true`, require `committed: true` and `transactionState: "committed"`; the compact default response is authoritative. Request `responseFormat: "detailed"` only when complete design snapshots and preview data are needed. If it has `nextAction: "review_warnings"`, inspect every warning and the frozen preview; warning-bearing responses remain detailed automatically. Call `apply-html-css-page-import` with the returned `previewToken`, the same `idempotencyKey`, and `acknowledgeWarnings: true` only after review. On errors or policy violations, revise the source and use a new idempotency key. Render-check desktop and mobile after persistence.

Use `documentPurpose: "migration"` only when faithfully migrating an external fragment whose semantic wrappers and browser defaults are part of the source contract. It is not an escape hatch for a rejected page shell.

## Native-only profile

When custom CSS and new globals are forbidden, preview with:

```json
{
  "options": {
    "preserve_html_defaults": false,
    "custom_css_policy": "forbid",
    "global_resource_policy": "forbid_creates"
  }
}
```

Do not weaken these policies to make a preview pass. Rewrite unsupported selectors or declarations into native-mappable HTML/CSS and preview the complete candidate again.

For one-off native styling, give elements stable HTML IDs and target those IDs in CSS. Ordinary class selectors propose global Bricks classes and can violate `forbid_creates`. Put responsive overrides in the supplied CSS with explicit media queries; do not omit the `css` field when the brief includes responsive behavior. With default Bricks breakpoints, mobile portrait is `@media (max-width: 478px)`. If the site uses custom breakpoints, read design context and use the site's actual width.

## Native element hints

- `<section>` creates a Section.
- `<div class="brxe-container">` creates a centered native Container.
- `<div class="brxe-block">` creates a native Block.
- `<a class="brxe-button" href="...">Label</a>` creates a linked native Button; a plain `<a>` remains a Text Link.
- Headings, paragraphs, images, video, audio, SVG, divs, and forms map conservatively to native elements.
- Code, iframe, canvas, tables, and unsupported structures can produce Code fallbacks. Rewrite them when native-only output is required.

Do not nest Containers inside Containers or Sections inside Sections. Use Blocks or Divs for inner layout. Make browser-default typography explicit in CSS. When the source uses `rem`, pass both `options.source_root_font_size_px` and `options.target_root_font_size_px`. Pass the same explicit value for both when no scaling is needed; this avoids a normalization warning and second acknowledgement call. Rem normalization does not rescale media-query widths, so author those widths for the target site.

## Other conversion work

Use `convert-html-css-to-bricks-data` only when the task needs converted data without immediately replacing one known empty page: snippets, component authoring, CSS-only reconciliation, reusable globals, or manual Bricks-specific wiring. Its output is read-only and must be reviewed before persistence.

For these advanced routes, read [full-guide.md](references/full-guide.md) before acting. It covers write preconditions, global classes and variables, CSS-only conversion, executable-content safety, source rendering fidelity, dynamic/nestable element limits, and post-conversion quality checks.
