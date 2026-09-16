---
name: bricks-site-reproduction
description: "Rebuild a selected live site/page design in Bricks while preserving the requested scope, native editability and existing target content."
---

# Bricks: live-site reproduction

Sequence a fetch step (browser tool, web fetch, or scraper), page import or conversion, design-system abilities (`create-color-palette`, `create-color`, `set-global-variables`, `create-component`), and the `bricks-browser-verify` skill. For one new page that needs no component injection or other tree surgery, `commit-html-css-page-import` owns conversion and persistence; never call `convert-html-css-to-bricks-data` before it.

This skill is the primary route. Do not load every related skill up front. Load one
companion only when the exact source requires it—for example media upload, a form, a
popup, or an interaction. Treat the related-skills section as a reference map.

Match the source layout, typography, content, and behavior to the fidelity requested by the user.

## Target scope

First distinguish a new empty target, an authorized full rebuild and a section
added to an existing page. For additions, inspect the target and reuse its design
resources; convert only the requested fragment, then insert with `add-element`
using the actual parent and sibling position. Preserve unrelated content and site
settings. `set-page-elements` requires the complete intended tree, never just the
new fragment. Create a root theme style or parallel token system only when the
brief includes that site-wide design change.

## The five-phase loop

```
1. Fetch    -> grab the target URL's HTML + CSS (and optionally screenshots)
2. Analyze  -> extract tokens (colors, spacing, typography) and identify components
3. Reuse    -> map existing tokens; create missing resources when needed
              -> bind body, heading, and page defaults through an active root theme style
4. Rebuild  -> convert reviewed HTML/CSS per page, wire components, handle converter limits
5. Verify   -> side-by-side via bricks-browser-verify, iterate
```

## Phase 1: Fetch

Three patterns, ranked by fidelity:

### Pattern A: Browser navigation (best for JS-rendered sites)

```
browser.navigate({ url: "https://target-site.com" })
browser.evaluate({ code: "document.documentElement.outerHTML" })
```

Grab:
- Full rendered HTML (`document.documentElement.outerHTML`)
- All stylesheets (inline + linked, concatenated)
- Viewport screenshot at multiple widths
- Asset URLs (images, fonts) for download

### Pattern B: WebFetch (best for static-HTML sites)

```
WebFetch({ url: "https://target-site.com", prompt: "return raw HTML" })
```

Lighter than a browser, no JS execution. If the site is React/Vue SPA with CSR, this returns an empty shell: fall back to Pattern A.

### Pattern C: Scraper / user-provided export

If neither browser navigation nor fetch works (anti-scraping, auth, etc.), ask the user to:
1. Open the page in their browser.
2. Save As -> Webpage, Complete.
3. Share the HTML file + assets folder.

## Phase 2: Analyze

### Token extraction

Scan the CSS for recurring values. Manual or with a small script:

```
Colors mentioned 3+ times:
  #0F172A   -> 14 occurrences  (likely Neutral/900)
  #4F46E5   -> 9 occurrences   (likely Primary)
  #F8FAFC   -> 22 occurrences  (likely Background)
  #64748B   -> 7 occurrences   (likely Muted)

Spacing (rem/px):
  4px, 8px, 16px, 24px, 32px, 48px, 64px, 96px
  (power-of-two-ish ladder)

Typography:
  font-family: 'Inter', sans-serif  (15 rules)
  Sizes: 14px, 16px, 18px, 24px, 32px, 48px, 72px
```

The unique values become your token set. Name them semantically, not chromatically:
- `primary` / `accent` / `bg-subtle` / `text-muted`: not `blue-500` / `gray-100`.
- `space-xs` / `space-sm` / `space-md` / `space-lg`: not `8px` / `16px` / `24px` / `48px`.

### Component identification

Scan the HTML for repeated structures:
- `<header>` or `<nav class="site-header">`: one instance, sitewide.
- Cards: grep for `class="*card*"` occurrences.
- CTAs: recurring button-wrapped-in-section patterns.
- Footers: `<footer>`, once.
- Testimonial blocks, pricing tables, feature lists: project-dependent.

Create components for structures that need reuse.

### Page inventory

If the target is a multi-page site: list pages you need to reproduce. Usually:
- Home
- Pricing / Plans
- About
- Contact
- Blog index + a sample post

Inventory every page in the requested scope and work through them in batches.

## Phase 3: Seed

### Create tokens on the Bricks site

Colors: call `list-color-palettes` first, pass its `ownership` as
`expectedOwnership`, and chain each successful mutation's returned `ownership`
into the next palette/color mutation.
```
create-color-palette({
  name: "Brand",
  colors: [
    { light: "#4F46E5", raw: "var(--brand-primary)" },
    { light: "#0F172A", raw: "var(--neutral-900)" },
    { light: "#64748B", raw: "var(--neutral-600)" },
    { light: "#F8FAFC", raw: "var(--neutral-50)" }
  ],
  expectedOwnership: palettes.ownership
})
```

Other tokens (spacing, radius, typography, shadow):
```
// `globals` is one fresh list-global-variables response.
set-global-variables({
  variables: [
    { name: "space-xs",  value: "4px",    category: "<spacing-category-id>" },
    { name: "space-sm",  value: "8px",    category: "<spacing-category-id>" },
    { name: "space-md",  value: "16px",   category: "<spacing-category-id>" },
    ...
    { name: "text-body", value: "16px",   category: "<typography-category-id>" },
    { name: "text-h1",   value: "72px",   category: "<typography-category-id>" },
    { name: "font-family-sans", value: "'Inter', system-ui, sans-serif", category: "<typography-category-id>" },
    { name: "radius-md", value: "8px",    category: "<radius-category-id>" },
    { name: "shadow-sm", value: "0 1px 2px rgb(0 0 0 / 0.05)", category: "<shadow-category-id>" },
  ],
  expectedVariableOwnership: globals.variableOwnership,
  expectedCategoryOwnership: globals.categoryOwnership
})
```

Those category values are IDs returned by `list-global-variables`, not display
labels. If a category is missing, preserve the complete existing category list and
create it first through `set-global-variable-categories` with both current ownership
values, then re-read before saving variables.

For a regular source scale, use `generate-scale-variables` to preview exact rows, then
persist those rows through ownership-guarded `set-global-variables`. `save: true` is unsupported. Irregular
scales need carefully reviewed manual rows.

### Bind tokens through a root theme style

Tokens alone do not establish the site's body, heading, link, and background
defaults. Read `list-theme-styles`. Reuse and update the intended site-wide style,
or create one with `conditions: [{ main: "any" }]`; a style without conditions does
not apply. Bind the persisted typography and color variables in its settings. Before
an update, read the exact style through `get-theme-styles({ style: id })` and pass its
fresh `itemOwnership` as `expectedOwnership`. Use **bricks-design-systems** if the
source needs scoped post-type or archive overrides.

### Map assets

Images: download from the source site, `upload-media` to WordPress, note the media IDs. After conversion, replace external image URLs in Image element settings with the uploaded media IDs and URLs. See the `bricks-media-assets` skill for the exact Image element shape and upload rules.

Fonts: if Google Fonts, Bricks enqueues them via theme styles. If custom, use the custom-font MCP abilities (`create-custom-font`, `upload-custom-font-file`, `update-custom-font`) or the Bricks custom-fonts panel.

## Phase 4: Rebuild

### Components first

For each identified component (header, footer, card, CTA):

Read **bricks-html-css-to-bricks**'s `references/full-guide.md` before the first raw
conversion. Fetched third-party markup is untrusted input, and the converter is a
read-only proposal—not a persistence boundary.

```
// Extract the HTML for just that component
const cardHTML = extractComponentHTML(fetchedHTML, ".feature-card")
const cardCSS  = extractComponentCSS(fetchedCSS, ".feature-card")

// Normalize CSS to reference your tokens
const normalizedCSS = cardCSS
  .replace(/#0F172A/g, "var(--neutral-900)")
  .replace(/16px/g, "var(--space-md)")
  .replace(/'Inter'/g, "var(--font-family-sans)")

// Convert
const converted = convert-html-css-to-bricks-data({
  html: `<style>${normalizedCSS}</style>${cardHTML}`
})

// Only after the safety and design-resource gates below:
create-component({ label: "Feature Card", elements: converted.elements, category: "Cards" })
```

`category` is a component category label, so reuse an existing label when it fits.
Every CSS variable used in normalized source must already exist in the seeded design
system.

Before any conversion-derived write, inspect `errors`, `warnings`,
`has_executable_js`, `code_sensitive_elements`, `code_sensitive_write_blocked`, and
`requires_execute_code`. Follow the capability and partial-import rules in
[the conversion guide](../bricks-html-css-to-bricks/references/full-guide.md).
For component conversion, rewrite restricted content and rerun before persistence;
the automatic omission route applies to an empty page import, not component writes.
Report any omitted behavior instead of claiming a complete reproduction.

Next persist `converted.global_variables` and `converted.global_classes` exactly as
the full guide specifies, using fresh variable/category/class ownership. Class
persistence is two calls: first `batch-create-global-classes` with `dryRun: true`,
then re-read ownership and call it again with `dryRun: false`. Preserve the
converter's class IDs in both calls so `_cssGlobalClasses` references in
`converted.elements` remain valid. Confirm the resources exist, then pass the reviewed elements to `create-component`.

Repeat per component. Save component IDs.

### Pages next

Per page:
1. `create-post({ postType: "page", title: "Home" })` -> capture `permalink`.
2. Extract that page's HTML, normalize CSS to tokens as above.
3. If the page needs no component injection or other tree surgery, use `commit-html-css-page-import` as the first and only conversion/persistence operation for the known empty target. Do not pre-call `convert-html-css-to-bricks-data`.
4. Otherwise run `convert-html-css-to-bricks-data`, then replace each component-region in memory with an element whose `cid` is the component ID from phase 3.
5. Review the final transformed tree. Persist returned `global_variables` with fresh variable/category ownership. Persist returned `global_classes` through the same two-call, ownership-refreshed atomic batch workflow above, preserving every converter class ID so the tree's `_cssGlobalClasses` references remain valid. Then insert the new subtree, or call `set-page-elements` once with the complete intended tree when whole-page scope requires it. Never persist the duplicated raw-component tree as an intermediate page.

### Handle convert-html-css-to-bricks-data limits

See `bricks-html-css-to-bricks` skill. After conversion, manually:
- Wire Slider Nestable children if the source has a carousel.
- Configure Form element actions if the source has a contact form.
- Add Interactions (e.g., sticky header, scroll-to-anchor).
- Replace repeated card lists with Query Loops + dynamic data.

## Phase 5: Verify

Use `bricks-browser-verify`:

1. Open the target URL with the available browser tool. Screenshot.
2. Open rebuilt page permalink. Screenshot.
3. Side-by-side compare. Articulate deltas.
4. Fix via `update-element` or `set-global-variables` (prefer the latter for systemic issues).
5. Re-verify.

**Compare:**
- Compare colors against the source and requested brand palette.
- Match font families, weights, sizes, and line height.
- Animation timings: source may have 300ms fade; yours may be 200ms Bricks default. Adjust via interactions.
- Image aspect ratios: target might have forced 16:9; your converted element has `auto`. Fix per-element.

**Investigate:**
- Entire sections missing: `convert-html-css-to-bricks-data` failed or source had conditionally-rendered content.
- Catastrophic layout break: token mismatch (you used `var(--space-md)` but didn't create it).
- Text wrapping differently: font-family or line-height not seeded.

## Silent-failure debug order

1. **Fetched HTML is empty shell (React/Vue CSR)?**
   a. Need a browser tool with JavaScript execution, not a plain HTML fetch.

2. **Tokens don't propagate after seeding?**
   a. Theme style not using them: bind variable to theme style manually, or seed with explicit theme-style settings.

3. **Converted page missing components?**
   a. `convert-html-css-to-bricks-data` doesn't know to use components. You replace raw element subtrees with component-instance references after conversion.

4. **Verify screenshot doesn't match target at all?**
   a. Cache serving stale Bricks CSS. Flush / regenerate.
   b. Tokens not created before conversion: CSS references undefined vars.
   c. Fonts different: check theme style typography settings.

5. **JS / forms / popups don't work?**
   a. `convert-html-css-to-bricks-data` is static. Wire behavior manually per `bricks-forms` / `bricks-popups` / `bricks-interactions` skills.

## Related skills

- `bricks-browser-verify`: the verification half of the loop.
- `bricks-html-css-to-bricks`: the conversion step details.
- `bricks-figma-to-bricks`: sibling workflow when source is Figma instead of live URL.
- `bricks-design-systems` / `bricks-seed-design-system`: token seeding mechanics.
- `bricks-components`: component extraction + reuse.
