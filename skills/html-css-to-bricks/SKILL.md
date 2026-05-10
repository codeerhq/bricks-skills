---
name: html-css-to-bricks
description: "Use when converting raw HTML and CSS into Bricks data: \"convert this HTML snippet\", \"import this codepen\", \"turn this CSS into Bricks classes\", \"turn this markup into Bricks elements\". Covers the `convert-html-css-to-bricks-data` ability, its known limits (nestables, interactions, JS), class-collision prevention via `list-global-classes`, variable-extraction strategy, CSS-only conversion, and when to author manually."
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

# Bricks: HTML/CSS -> Bricks conversion

The `convert-html-css-to-bricks-data` MCP ability parses HTML and CSS into Bricks data. With HTML, it maps each node to a Bricks native element type and returns a Bricks element tree ready for `set-page-elements` / `add-element`. Use this as the default path for greenfield static visual sections, page shells, and template shells: write clean semantic HTML/CSS first, convert it, then wire Bricks-specific behavior manually.

With CSS only, it returns global classes, global variables, matching existing elements to update when you pass `postId` or `elements`, and fallback Code elements for CSS that cannot become Bricks controls. CSS-only conversion is useful when importing a stylesheet into an existing Bricks page or template.

Manual Bricks JSON authoring is better for small targeted edits, query/filter/form/interaction wiring, nestable elements the converter cannot represent, and settings you have already verified through `get-element-schema`.

For visual CSS, prefer conversion over hand-authored Bricks settings. Write normal HTML and CSS, then let `convert-html-css-to-bricks-data` move mappable CSS into Bricks controls and keep only the CSS that truly needs to remain custom.

## Native layout hints

Use `<div class="brxe-container">` when you want a native Bricks Container: the centered content wrapper whose width comes from the site's Bricks/theme styles (default 1100px, but sites can override it).

Use `<div class="brxe-block">` when you want a native Bricks Block: a full-width flex column layout element.

`.brx-*` and `.brxe-*` classes are reserved Bricks/native selectors. The converter may use them as element hints, but it does not import them as global classes. Only write CSS against these selectors when you intentionally want to affect native Bricks layout globally; prefer theme styles/native settings for that when available.

## The happy path

```
convert-html-css-to-bricks-data({
  html: "<style>.hero { padding: 64px 24px; text-align: center; }</style><section class='hero'><h1>Welcome</h1><p>Intro copy</p></section>",
  options: {
    create_global_classes: true,
    extract_variables: true
  }
})
```

`convert-html-css-to-bricks-data` accepts `html`, `css`, optional `postId` / `elements` context for CSS-only conversion, and optional `options`. Inline `<style>` tags inside `html` still work. It returns `{ mode, elements, global_classes, global_variables, has_executable_js, class_map, warnings, errors }`; CSS-only responses can also include `{ elements_to_update, generated_elements, remaining_css_for_code_element }`.

Treat the returned element tree as **tainted until reviewed**. If `has_executable_js` is true, or if the output contains Code/SVG/query-editor payloads, do not persist it with `set-page-elements`, `add-element`, `create-template`, or `create-component` unless the current user has Bricks Execute code permission and the human explicitly approved the code. Prefer replacing scripts with Bricks interactions or removing the Code element before saving.

The conversion is read-only. If `global_classes` or `global_variables` is non-empty, persist those design resources before saving the returned elements. If you persist generated global classes through `create-global-class`, remap the converted elements' `_cssGlobalClasses` IDs to the IDs returned by `create-global-class`, because that ability generates new IDs (`includes/abilities/design.php:1146`).

Then wire the returned flat element array to a page:

```
set-page-elements({ postId: 42, elements: <elements> })
```

Or wrap as a component:

```
create-component({ label: "Hero", elements: <elements> })
```

## CSS-only imports

Use CSS-only conversion when you already have a Bricks page/template and want to turn normal CSS into Bricks global classes, variables, and element updates:

```
convert-html-css-to-bricks-data({
  postId: 42,
  css: `
    :root { --feature-card-radius: 12px; }
    .feature-card { display: grid; gap: 16px; border-radius: var(--feature-card-radius); }
    .feature-card:hover { transform: translateY(-2px); }
  `
})
```

If `postId` is provided, the ability reads that page/template's current element tree and reports `elements_to_update` for elements using matching local class names. Review the returned globals, create or update those design resources, then apply the returned element updates. The conversion itself is read-only.

## Pre-flight: always run before convert-html-css-to-bricks-data

### 1. Class-collision check

`list-global-classes` returns every global class on the site. If your HTML uses `.hero`, `.card`, `.btn`: names common across projects: a collision with an existing global means Bricks merges styles, not yours.

```
const existing = list-global-classes().items.map(item => item.name)
const incoming = extractClassNames(htmlSnippet)
const collisions = incoming.filter(c => existing.includes(c))
```

Three options when collisions exist:
1. **Rename incoming**: prefix with a project-scope (`.promo-hero`, `.promo-card`). Safest.
2. **Reuse existing**: if the existing global already provides the right styling, drop the incoming CSS for those classes.
3. **Inline styles**: `convert-html-css-to-bricks-data` can accept inline-only CSS (no classes). Loses reusability but avoids collision.

Prefer option 1 for imports; option 2 when intentionally aligning to the site's design system.

### 2. Variable extraction

If the CSS contains repeated values (colors, spacing, radius), extract them to global variables **before** conversion. Otherwise every element gets a literal `16px` / `#0F172A`, and future changes require editing each element.

```
// Before convert-html-css-to-bricks-data:
set-global-variables({
  variables: [
    { name: "promo-accent",  value: "#F59E0B",   category: "color" },
    { name: "promo-radius",  value: "12px",       category: "radius" }
  ]
})

// Then replace literals in the CSS string:
css = css.replace(/#F59E0B/g, "var(--promo-accent)")
        .replace(/border-radius: 12px/g, "border-radius: var(--promo-radius)")
```

Not strictly necessary for one-off snippets. Necessary for 3+ pages or a long-term design system.

### 3. Semantic sanity

`convert-html-css-to-bricks-data` maps HTML tags to Bricks elements conservatively:

| HTML | Bricks element |
|---|---|
| `<section>`, `<header>`, `<footer>`, `<article>`, `<aside>` | Section |
| `<div class="brxe-container">` | Container |
| `<div class="brxe-block">` | Block |
| `<div>`, `<nav>`, `<main>`, `<span>`, `<ul>`, `<ol>`, `<li>`, `<figure>`, `<blockquote>` | Div with the closest tag setting |
| `<h1>`-`<h6>` | Heading |
| `<p>`, `<label>` | Basic Text |
| `<img>` | Image |
| `<a>` | Text Link |
| `<button>` | Button |
| `<form>` | Form |
| `<video>`, `<audio>` | Video / Audio |
| `<svg>` | SVG element |
| `<pre>`, `<code>`, `<iframe>`, `<canvas>`, `<table>` and table parts | Code fallback |
| Anything unrecognized | Skipped, inlined, or code fallback depending on context |

The converter's native element set is intentionally small: `section`, `container`, `block`, `div`, `heading`, `text-basic`, `text-link`, `icon`, `button`, `image`, `svg`, `video`, `audio`, `code`, `divider`, `form`.

If the ability returns lots of `code` fallbacks, your source HTML uses structures the converter does not model natively. Rewrite the HTML before re-running, or convert the static shell and then replace the fallback with an exact Bricks element after checking its schema.

## Known limits: when convert-html-css-to-bricks-data can't

`convert-html-css-to-bricks-data` produces **static structure only**. It cannot produce:

### 1. Nestable elements requiring state

- **Slider Nestable**: children are slides; no HTML structure describes slide-transition state.
- **Accordion Nestable**: header + content pairs with open/closed state.
- **Tabs Nestable**: tab-button + tab-content pairing.
- **Dropdown / Offcanvas**: triggers + panels with show/hide state.

For sliders/carousels, prefer `slider-nested`; for accordions, prefer `accordion-nested`. Check the element schema first via `element-schemas` / `get-element-schema`.

For these: let `convert-html-css-to-bricks-data` output a Block with child elements, then manually:
1. `add-element` with `element: { name: "slider-nested" }`, `element: { name: "accordion-nested" }`, or `element: { name: "tabs-nested" }`.
2. For each child in the converted output, `add-element` as a child of the nestable.
3. Delete the original converted Block.

Or author the nestable directly via `add-element` and ignore `convert-html-css-to-bricks-data` for that section.

### 2. Interactions and JS behavior

`<button onclick="...">` -> Bricks Button element with **no interaction wired**. You must add via `update-element-interactions` (see `interactions` skill).

```
// After convert-html-css-to-bricks-data:
update-element-interactions({
  postId: 42,
  elementId: "btn-xyz",
  interactions: [
    {
      trigger: "click",
      action: "show",
      target: "popup",
      templateId: 123
    }
  ]
})
```

### 3. Form field logic

`<form>` converts to a Bricks Form element with default fields. Actions, validation, email/webhook config: none of that is in the HTML. Use `update-form-fields` + `update-form-actions` (see `forms` skill).

### 4. Query-driven content

`convert-html-css-to-bricks-data` treats repeating cards as literal duplicated elements. If the source is "three cards" meant to be "posts from a query loop," convert output needs manual replacement:

1. Take the first card's subtree.
2. `add-element` as a single card with `element: { name: "block", settings: { hasLoop: true, query: { objectType: "post", postType: ["post"] } }, children: [...] }`.
3. Configure the loop query via `update-element` by updating the element's `settings.query` object.
4. Inside, add dynamic tags (`{post_title}`, `{post_excerpt}`) to replace literal card text.

See the `query-loops` skill.

### 5. Custom dynamic data

`{my_plan_name}` in the HTML stays as literal text. Dynamic tags need to be re-inserted in element controls after conversion.

## Class-name normalization

Bricks' global class references are stored as IDs internally. `convert-html-css-to-bricks-data` returns global class objects and rewrites matching element settings to `_cssGlobalClasses`, but it does not save those classes by itself. Two side-effects:

1. **Name collisions**: If your HTML uses `.card-body` and the site already has `.card-body`, convert-html-css-to-bricks-data maps to the existing class ID when the incoming CSS has no conflict or the settings match. If incoming CSS conflicts, the returned `global_classes` object needs a deliberate save/remap decision.

2. **BEM / complex CSS**: Class names like `.card__body--highlighted` are fine. More advanced CSS such as `:has()` may work in modern browsers but not always in the builder preview, so review the converted output before saving.

## CSS handling

When your HTML contains CSS in `<style>` tags, `convert-html-css-to-bricks-data`:

1. Parses the CSS.
2. For each class that matches an element in the HTML, returns a global class object with the mapped settings.
3. Rules that do not target converted classes or element IDs are kept in a CSS Code element at the start of the returned element array.
4. Media queries -> Bricks breakpoint-scoped rules (scoped to mobile / tablet / desktop).
5. `:hover` / `:focus` / `:active` pseudo-states -> stored as pseudo-class CSS on the global class.

**Limitations:**
- `@keyframes` not supported in the class: paste into the page's Custom CSS.
- `@font-face` same: Bricks Custom Fonts panel instead.
- `@supports` discarded.
- `:has()`, `:is()`, `:where()` stored as-is: runtime behavior depends on the browser.

## After-convert cleanup checklist

1. Open the page in the builder. Confirm structure looks right.
2. Check the element tree for unexpected `code` fallback elements. Convert each to a proper element type if possible.
3. Replace static text, images, and links with dynamic data where the content should come from WordPress, ACF, or another provider.
4. Replace repeated static cards/items with a query loop when they represent posts, terms, users, or another data source.
5. Spot-check 2-3 classes in the Global Classes panel: does the CSS match the source?

## When to author manually instead

Skip `convert-html-css-to-bricks-data` when:
- The HTML is <5 elements. Faster to `add-element` directly.
- The source is not HTML (Tailwind JSX, React, Vue SFC): pre-process to plain HTML or author manually.
- You already know the structure will be mostly nestables / forms. Conversion output needs too much post-processing.
- You need tight control over element IDs, classes, dynamic data: conversion output is generated and nondeterministic.

## Silent-failure debug order

1. **convert-html-css-to-bricks-data returns empty tree?**
   a. HTML malformed: run through a validator.
   b. Root element not a recognized tag: wrap in `<div>` or `<section>`.

2. **Classes appear but CSS doesn't render?**
   a. CSS passed as second arg? Or left out?
   b. Media queries in unrecognized formats (e.g., `@media (prefers-color-scheme: dark)`: supported but breakpoint-scoped output may not include it).

3. **Too many "HTML" elements in output?**
   a. Source uses `<div>` for everything: add semantic tags.

4. **Collision with existing global class?**
   a. `list-global-classes` before conversion.
   b. Rename in source HTML / CSS.

5. **Converted tree too deep / nested awkwardly?**
   a. Source has redundant wrapping `<div>`s: strip in source.

## Never do

- Feed minified CSS without a source map. Class rules get misattributed.
- Pass HTML with inline styles + classes both. Inline always wins; class rules appear dead.
- Rely on convert-html-css-to-bricks-data for sliders / forms / popups / interactions: it won't wire them.
- Skip class-collision check on a site with an existing design system. You'll overwrite styles.
- Convert 1000-line HTML files as one call. Split into sections, convert each, then compose.

## Related skills

- `figma-to-bricks`: upstream: how to get clean HTML from Figma.
- `element-schemas`: exact schemas for uncommon elements or post-conversion replacements.
- `media-assets`: upload images to the media library and wire Image element settings.
- `design-systems` / `naming-conventions`: class-naming strategy before conversion.
- `query-loops`: convert repeated patterns into dynamic loops.
- `dynamic-data`: verify provider tags before replacing static content.
