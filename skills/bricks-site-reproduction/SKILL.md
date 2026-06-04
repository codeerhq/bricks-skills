---
name: bricks-site-reproduction
description: "Use when the user asks to rebuild an existing live site or landing page in Bricks: \"reproduce this URL in Bricks\", \"clone this landing page\", \"recreate this site's design\". Covers the fetch -> analyze -> extract-tokens -> rebuild -> verify loop composing `convert-html-css-to-bricks-data`, design-system abilities, and the `bricks-browser-verify` skill."
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

# Bricks: live-site reproduction

No new Bricks abilities here. This workflow composes existing abilities. It sequences a fetch step (browser tool, web fetch, or scraper), `convert-html-css-to-bricks-data`, design-system abilities (`create-color-palette`, `create-color`, `set-global-variables`, `create-component`), and the `bricks-browser-verify` skill.

Reproduction here = visual + structural match. Not pixel-identical; close enough that an end user would recognize the design. Legal / copyright considerations are the user's responsibility, not this skill's.

## The five-phase loop

```
1. Fetch    -> grab the target URL's HTML + CSS (and optionally screenshots)
2. Analyze  -> extract tokens (colors, spacing, typography) and identify components
3. Seed     -> create tokens on the Bricks site via design-system abilities
4. Rebuild  -> convert HTML/CSS per page, wire components, handle convert-html-css-to-bricks-data limits
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

You still parse it yourself, just from disk instead of network.

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

Semantic naming makes the design system portable; chromatic naming locks you to the source.

### Component identification

Scan the HTML for repeated structures:
- `<header>` or `<nav class="site-header">`: one instance, sitewide.
- Cards: grep for `class="*card*"` occurrences.
- CTAs: recurring button-wrapped-in-section patterns.
- Footers: `<footer>`, once.
- Testimonial blocks, pricing tables, feature lists: project-dependent.

List them. Each becomes a Bricks component in phase 3.

### Page inventory

If the target is a multi-page site: list pages you need to reproduce. Usually:
- Home
- Pricing / Plans
- About
- Contact
- Blog index + a sample post

Don't try to clone 50 pages; pick the 3-5 that matter.

## Phase 3: Seed

### Create tokens on the Bricks site

Colors:
```
create-color-palette({
  name: "Brand",
  colors: [
    { light: "#4F46E5" },
    { light: "#0F172A" },
    { light: "#64748B" },
    { light: "#F8FAFC" }
  ]
})
```

Other tokens (spacing, radius, typography, shadow):
```
set-global-variables({
  variables: [
    { name: "space-xs",  value: "4px",    category: "spacing" },
    { name: "space-sm",  value: "8px",    category: "spacing" },
    { name: "space-md",  value: "16px",   category: "spacing" },
    ...
    { name: "text-body", value: "16px",   category: "typography" },
    { name: "text-h1",   value: "72px",   category: "typography" },
    { name: "radius-md", value: "8px",    category: "radius" },
    { name: "shadow-sm", value: "0 1px 2px rgb(0 0 0 / 0.05)", category: "shadow" },
  ]
})
```

For scale-based variables (spacing, font sizes), `generate-scale-variables` can seed in one call: but only if the source scale is regular (2x ladder, golden ratio). Irregular scales need manual entry.

### Map assets

Images: download from the source site, `upload-media` to WordPress, note the media IDs. After conversion, replace external image URLs in Image element settings with the uploaded media IDs and URLs. See the `bricks-media-assets` skill for the exact Image element shape and upload rules.

Fonts: if Google Fonts, Bricks enqueues them via theme styles. If custom, use the custom-font MCP abilities (`create-custom-font`, `upload-custom-font-file`, `update-custom-font`) or the Bricks custom-fonts panel.

## Phase 4: Rebuild

### Components first

For each identified component (header, footer, card, CTA):

```
// Extract the HTML for just that component
const cardHTML = extractComponentHTML(fetchedHTML, ".feature-card")
const cardCSS  = extractComponentCSS(fetchedCSS, ".feature-card")

// Normalize CSS to reference your tokens
const normalizedCSS = cardCSS
  .replace(/#0F172A/g, "var(--_bp-neutral-900)")
  .replace(/16px/g, "var(--space-md)")
  .replace(/'Inter'/g, "var(--font-family-sans)")

// Convert
const converted = convert-html-css-to-bricks-data({
  html: `<style>${normalizedCSS}</style>${cardHTML}`
})

// Wrap as component
create-component({ label: "Feature Card", elements: converted.elements, category: "Cards" })
```

Repeat per component. Save component IDs.

### Pages next

Per page:
1. `create-post({ postType: "page", title: "Home" })` -> capture `permalink`.
2. Extract that page's HTML, normalize CSS to tokens as above.
3. `convert-html-css-to-bricks-data` the whole page.
4. Persist or remap any returned `global_classes` / `global_variables`, then call `set-page-elements({ postId, elements: converted.elements })`.
5. For each component-region in the converted output (header, cards, footer, CTA), **replace the raw subtree with a component instance**: use an element object with `cid` set to the component ID from phase 3.

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

**Expected deltas:**
- Color nudges (target `#0E1729` vs your `#0F172A`): not worth fixing unless brand-critical.
- Font-rendering differences (target uses Inter via Google Fonts; you might use a system fallback): match the font or accept.
- Animation timings: source may have 300ms fade; yours may be 200ms Bricks default. Adjust via interactions.
- Image aspect ratios: target might have forced 16:9; your converted element has `auto`. Fix per-element.

**Unexpected deltas are bugs:**
- Entire sections missing: `convert-html-css-to-bricks-data` failed or source had conditionally-rendered content.
- Catastrophic layout break: token mismatch (you used `var(--space-md)` but didn't create it).
- Text wrapping differently: font-family or line-height not seeded.

## When NOT to reproduce

Assumptions:
- You have the legal right to reproduce the design (client's own site, open-source project, demo).
- The target isn't a SaaS product with an active ToS forbidding reproduction.
- You're not cloning a competitor to mislead users.

When unsure, confirm with the user before starting.

## Rate-limiting the fetch

For multi-page scrapes, don't hammer the target:

```
// Pseudocode:
for (const url of pages) {
  const html = await fetch(url)
  await sleep(2000)  // 2s between requests, be polite
  save(html)
}
```

Browser tools typically add their own think-time. Web fetch is single-shot. User-provided exports skip this entirely.

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

## Testing the loop

End-to-end on a simple static landing page (no forms, no JS):

1. Fetch -> got HTML + CSS. OK
2. Analyze -> extracted 6 colors, 5 spacing tokens, 3 font sizes. OK
3. Seed -> `list-color-palettes` + `list-global-variables` confirm presence. OK
4. Rebuild -> `get-page-elements` returns a tree; no "HTML" passthrough elements. OK
5. Verify -> screenshots match within 5px at desktop viewport. OK

If step 5 doesn't converge in 3 iterations, the source is too complex for `convert-html-css-to-bricks-data` alone. Rebuild the complex parts manually.

## Never do

- Scrape a site without the user confirming they have the right.
- Trust convert-html-css-to-bricks-data output blind. Always screenshot-verify.
- Reproduce forms / popups / interactions without manual wiring: convert-html-css-to-bricks-data is structural only.
- Skip token extraction, convert raw hex values everywhere. You'll produce an unmaintainable site.
- Try to clone 50 pages in one session. Pick 3-5 key pages. Iterate.
- Ship without legal confirmation if the source is a paid / closed product.

## Related skills

- `bricks-browser-verify`: the verification half of the loop.
- `bricks-html-css-to-bricks`: the conversion step details.
- `bricks-figma-to-bricks`: sibling workflow when source is Figma instead of live URL.
- `bricks-design-systems` / `bricks-seed-design-system`: token seeding mechanics.
- `bricks-components`: component extraction + reuse.
