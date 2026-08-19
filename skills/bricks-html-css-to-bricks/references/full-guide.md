# HTML/CSS to Bricks detailed guide

Use this reference only for the advanced routes selected in the parent skill. For a straightforward known empty page or template, follow the parent skill's `commit-html-css-page-import` route instead.

**Requires:** Bricks 2.4+ with the Abilities API enabled

## Contents

- [Native-only import profile](#native-only-import-profile)
- [Native layout hints](#native-layout-hints)
- [Conditional raw-conversion path](#conditional-raw-conversion-path)
- [Preserve the source rendering environment](#preserve-the-source-rendering-environment)
- [CSS-only imports](#css-only-imports)
- [Pre-flight](#pre-flight)
- [Known conversion limits](#known-limits-when-convert-html-css-to-bricks-data-cant)
- [Class-name normalization](#class-name-normalization)
- [CSS handling](#css-handling)
- [After-convert cleanup](#after-convert-cleanup-checklist)
- [When to author manually](#when-to-author-manually-instead)
- [Silent-failure debugging](#silent-failure-debug-order)
- [Related skills](#related-skills)

## Native-only import profile

When the brief forbids custom CSS and newly created global resources, pass these exact preview options:

```
options: {
  preserve_html_defaults: false,
  custom_css_policy: "forbid",
  global_resource_policy: "forbid_creates"
}
```

`preserve_html_defaults: false` prevents semantic browser-default compensation from becoming element custom CSS. `custom_css_policy: "forbid"` makes unmapped CSS fail closed instead of silently persisting `_cssCustom` or a Code fallback. `global_resource_policy: "forbid_creates"` prevents the transaction from creating classes or variables outside the page tree. Do not weaken these policies to make a preview pass. Rewrite selectors and declarations into forms the native converter can map, then preview the complete candidate again.

If the user explicitly wants reusable global classes or variables, or accepts necessary custom CSS, choose the less restrictive documented policies that match that brief. Never infer that permission merely because the first preview fails.

The lower-level `convert-html-css-to-bricks-data` MCP ability remains useful when you need converted data without immediately replacing one known empty page: snippets, component authoring, CSS-only reconciliation, or manual Bricks-specific wiring. With HTML, it maps each node to a Bricks native element type and returns a Bricks element tree ready for explicit persistence.

With CSS only, it returns global classes, global variables, matching existing elements to update when you pass `postId` or `elements`, and fallback Code elements for CSS that cannot become Bricks controls. CSS-only conversion is useful when importing a stylesheet into an existing Bricks page or template.

Manual Bricks JSON authoring is better for small targeted edits, query/filter/form/interaction wiring, nestable elements the converter cannot represent, and settings you have already verified through `get-element-schema`.

For visual CSS, prefer conversion over hand-authored Bricks settings. Write normal HTML and CSS, then let `convert-html-css-to-bricks-data` move mappable CSS into Bricks controls and keep only the CSS that truly needs to remain custom.

## Native layout hints

Use `<div class="brxe-container">` only when you want a native Bricks Container: the usual first direct child inside a Section, centered to the site's normal content width (default 1100px, but sites can override it). Skip it for full-bleed layouts.

Use `<div class="brxe-block">` when you want a native Bricks Block: a full-width flex column layout element.

Use `<a class="brxe-button" href="...">Label</a>` when a linked CTA must become a native Bricks Button. A plain `<a>` intentionally remains a Text Link.

For native-only one-off page styling, assign stable HTML IDs and target those IDs in CSS. Ordinary class selectors propose global Bricks classes and will be rejected by `global_resource_policy: "forbid_creates"`.

Do not nest Containers inside Containers. Do not nest Sections inside Sections. Use Blocks or normal Divs inside a Container for inner layout.

`.brx-*` and `.brxe-*` classes are reserved Bricks/native selectors. The converter may use them as element hints, but it does not import them as global classes. Only write CSS against these selectors when you intentionally want to affect native Bricks layout globally; prefer theme styles/native settings for that when available.

## Conditional raw-conversion path

```
convert-html-css-to-bricks-data({
  html: "<style>.hero { padding: 64px 24px; text-align: center; }</style><section class='hero'><h1>Welcome</h1><p>Intro copy</p></section>",
  options: {
    create_global_classes: true,
    extract_variables: true,
    source_root_font_size_px: 16,
    target_root_font_size_px: 10
  }
})
```

`convert-html-css-to-bricks-data` accepts `html`, `css`, optional `postId` / `elements` context for CSS-only conversion, and optional `options`. Inline `<style>` tags inside `html` still work. It returns `{ mode, elements, global_classes, global_variables, has_executable_js, class_map, warnings, errors }`; CSS-only responses can also include `{ elements_to_update, generated_elements, remaining_css_for_code_element }`.

Also inspect `rem_normalization`, `code_sensitive_elements`,
`code_sensitive_write_blocked`, and `requires_execute_code`. Treat the returned
tree as **tainted until reviewed**. When `code_sensitive_write_blocked` is true,
do not persist any conversion-derived variables, classes, or elements. Remove or
replace every listed code-sensitive element, then rerun conversion and render
validation. When execution is permitted, still require explicit human approval for
executable Code/SVG/query-editor payloads.

The conversion is read-only. Before saving, read the current ownership values:
`list-global-variables` for `variableOwnership` + `categoryOwnership`, and
`list-global-classes` for `ownership` (+ `categoryOwnership` when converted classes
use categories). Persist `global_variables` with both variable/category ownership values.
Persist `global_classes` in one `batch-create-global-classes` call with the latest
class `ownership` as `expectedOwnership`; never substitute the coarse design-context
`version`. Preserve the converter's class IDs; do not recreate classes individually
or remap `_cssGlobalClasses`. Dry-run the class batch with that same ownership, then
re-read and apply against fresh ownership if anything changed between calls.

Then wire the returned flat element array to a page:

```
set-page-elements({ postId: 42, elements: <elements> })
```

Or wrap as a component:

```
create-component({ label: "Hero", elements: <elements> })
```

## Preserve the source rendering environment

Raw HTML/CSS is not a complete visual specification. Before conversion, account for
these two common differences:

1. **Root-relative units.** Ordinary external web CSS usually resolves `rem`
   against a 16px browser root, while Bricks normally uses a 10px root. Compare the
   source and target computed roots. When they differ, pass both
   `source_root_font_size_px` and `target_root_font_size_px`. Inspect
   `rem_normalization` before persistence. Never manually rescale values the
   converter already normalized, and never rescale media-query widths.
2. **User-agent styles.** Browsers add implicit presentation to semantic headings,
   paragraphs, lists, and similar elements, while Bricks resets some of it. If the
   source appearance relies on an implicit size, weight, line height, or margin,
   make that value explicit in the source CSS before conversion. Do not add defaults
   that the author CSS already overrides.

For a fetched live page, prefer captured computed styles over guessing either
environment. A structurally correct conversion can still be visibly too short when
paragraph and heading defaults were omitted.

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

## Pre-flight

### 1. Class-collision check

Call `get-design-context` with `responseFormat: "summary"` before conversion. Use
`list-global-classes` only when the compact context is insufficient for collision
review. If your HTML uses common names such as `.hero`, `.card`, or `.btn`, a
collision with an existing global can merge styles unintentionally.

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

If the CSS contains repeated values (colors, spacing, radius), normalize them to
well-named CSS custom properties in memory before conversion. Let the read-only
conversion return the candidate `global_variables`; review them with the rest of
the conversion before writing anything. Otherwise every element gets a literal
`16px` / `#0F172A`, and future changes require editing each element.

```
// Before conversion, rewrite literals in the candidate CSS:
css = css.replace(/#F59E0B/g, "var(--promo-accent)")
        .replace(/border-radius: 12px/g, "border-radius: var(--promo-radius)")

// After conversion review, use one current list-global-variables response.
set-global-variables({
  variables: converted.global_variables,
  expectedVariableOwnership: globals.variableOwnership,
  expectedCategoryOwnership: globals.categoryOwnership
})
```

Not strictly necessary for one-off snippets. Necessary for 3+ pages or a long-term design system.

### 3. Semantic sanity

`convert-html-css-to-bricks-data` maps HTML tags to Bricks elements conservatively:

| HTML | Bricks element |
|---|---|
| `<section>`, `<header>`, `<footer>` | Section. Do not place Sections inside Sections. |
| `<section><div class="brxe-container">...` | Container. Use as the section's direct site-width wrapper when needed. |
| `<div class="brxe-block">` | Block. Prefer for inner layout inside Containers. |
| `<div>`, `<article>`, `<aside>`, `<nav>`, `<main>`, `<span>`, `<ul>`, `<ol>`, `<li>`, `<figure>`, `<blockquote>` | Div with the closest semantic tag setting |
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

`<button onclick="...">` -> Bricks Button element with **no interaction wired**. You must add via `update-element-interactions` (see `bricks-interactions` skill).

```
// After convert-html-css-to-bricks-data:
update-element-interactions({
  postId: 42,
  elementId: "btnx01",
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

`<form>` converts to a Bricks Form element with default fields. Actions, validation, email/webhook config: none of that is in the HTML. Use `update-form-fields` + `update-form-actions` (see `bricks-forms` skill).

### 4. Query-driven content

`convert-html-css-to-bricks-data` treats repeating cards as literal duplicated elements. If the source is "three cards" meant to be "posts from a query loop," convert output needs manual replacement:

1. Take the first card's subtree.
2. `add-element` as a single card with `element: { name: "block", settings: { hasLoop: true, query: { objectType: "post", postType: ["post"] } }, children: [...] }`.
3. Configure the loop query via `update-element` by updating the element's `settings.query` object.
4. Inside, add dynamic tags (`{post_title}`, `{post_excerpt}`) to replace literal card text.

See the `bricks-query-loops` skill.

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
3. Rules that cannot target a converted class or element ID are kept in a CSS Code element at the start of the returned element array. Broad document selectors such as `*`, `body`, and bare tag selectors commonly take this path. Move safe inherited/root presentation to the converted content root and turn relied-on tag presentation into explicit low-specificity classes before rerunning. For a relied-on universal `box-sizing` reset, first confirm whether Bricks already supplies it; otherwise scope it to the imported root and descendants as reviewed class custom CSS instead of keeping a document-wide Code fallback.
4. Media queries -> Bricks breakpoint-scoped rules (scoped to mobile / tablet / desktop).
5. `:hover` / `:focus` / `:active` pseudo-states -> stored as pseudo-class CSS on the global class.

**Limitations:**
- `@keyframes` not supported in the class: paste into the page's Custom CSS.
- `@font-face` same: Bricks Custom Fonts panel instead.
- `@supports` discarded.
- `:has()`, `:is()`, `:where()` stored as-is: runtime behavior depends on the browser.

## After-convert cleanup checklist

1. Open the page in the Builder and confirm the native structure and controls. If
   Builder access is unavailable, report that limitation and use stored-data plus
   multi-viewport frontend proof; do not claim Builder verification.
2. Check the element tree for unexpected `code` fallback elements. Convert each to a proper element type if possible.
3. Replace static text, images, and links with dynamic data where the content should come from WordPress, ACF, or another provider.
4. Replace repeated static cards/items with a query loop when they represent posts, terms, users, or another data source.
5. Spot-check 2-3 classes in the Global Classes panel: does the CSS match the source?

## When to author manually instead

Skip the raw `convert-html-css-to-bricks-data` route when:
- The target is a known empty page or template and the source is a complete visual shell. Use `commit-html-css-page-import` even for a small shell so conversion, design resources, persistence, and readback stay one workflow.
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

- Feed unreadable minified CSS when you still need to inspect or normalize its rules. Beautify it first; the converter does not consume source maps.
- Pass HTML with inline styles + classes both. Inline always wins; class rules appear dead.
- Rely on convert-html-css-to-bricks-data for sliders / forms / popups / interactions: it won't wire them.
- Skip class-collision check on a site with an existing design system. You'll overwrite styles.
- Copy external `rem` values into Bricks without comparing source and target root sizes.
- Assume raw author CSS includes browser user-agent heading and paragraph defaults.
- Convert 1000-line HTML files as one call. Split into sections, convert each, then compose.

## Related skills

- `figma-to-bricks`: upstream: how to get clean HTML from Figma.
- `element-schemas`: exact schemas for uncommon elements or post-conversion replacements.
- `media-assets`: upload images to the media library and wire Image element settings.
- `design-systems` / `naming-conventions`: class-naming strategy before conversion.
- `query-loops`: convert repeated patterns into dynamic loops.
- `dynamic-data`: verify provider tags before replacing static content.
