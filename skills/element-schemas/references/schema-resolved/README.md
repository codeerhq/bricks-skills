# Bricks Data Model

This page explains how Bricks structures its data. Use it alongside the individual element and control schemas to understand or generate valid Bricks content. Each JSON file describes the exact shape of data Bricks reads and writes, so AI coding assistants, build tools, import/export scripts, and custom integrations can generate, validate, or transform Bricks content without the builder UI.

**Schema version:** 2.3.6

## Element structure

Every element in Bricks shares the same envelope, regardless of its type:

```json
{
  "id": "dlceeu",
  "name": "button",
  "parent": 0,
  "children": [],
  "settings": { "text": "I am a button", "style": "primary" },
  "label": "My Button"
}
```

The element envelope has 8 fields (`id`, `name`, `parent`, `children`, `settings`, `selectors`, `label`, `themeStyles`). The `settings` object combines three layers: element-specific controls, inherited CSS controls (the `_`-prefixed keys), and meta-settings (`_cssGlobalClasses`, `_conditions`, `_interactions`, `_attributes`, etc.).

See the [Element schema](elements/common/element.json) for the full envelope reference, settings layers, meta-settings, and selectors documentation.

## Content areas

A Bricks page (or any post type using Bricks) stores its elements across three independent content areas: header, content, and footer. Each content area is a flat array of elements with parent-child references (not a nested tree). An array may contain both regular elements and component instances (identifiable by the presence of a `cid` field).

| Content area | WordPress post meta key | Description |
|---|---|---|
| Header | `_bricks_page_header_2` | Header template elements |
| Content | `_bricks_page_content_2` | Main page/post content |
| Footer | `_bricks_page_footer_2` | Footer template elements |

All three content areas use the exact same data structure: an array of elements as described in the [Element schema](elements/common/element.json).

**Storage:** These are stored as serialized arrays in the `wp_postmeta` table.

| Data | Meta key | PHP constant |
|---|---|---|
| Header elements | `_bricks_page_header_2` | `BRICKS_DB_PAGE_HEADER` |
| Content elements | `_bricks_page_content_2` | `BRICKS_DB_PAGE_CONTENT` |
| Footer elements | `_bricks_page_footer_2` | `BRICKS_DB_PAGE_FOOTER` |

See the [Content Area schema](general/content-area.json) for the array structure and storage details.

### Responsive and state variants

CSS-related settings support breakpoint and pseudo-class suffixes using colon syntax. A setting key with no suffix applies at the base breakpoint (desktop by default):

```
_typography                          → base breakpoint (no suffix)
_typography:tablet_portrait          → tablet portrait breakpoint
_typography:mobile_landscape:hover   → mobile landscape + hover state
```

## Page settings

Per-page configuration controlling header/footer visibility, scroll behavior, SEO metadata, social sharing, and custom code injection. These settings apply to the specific post being edited and are separate from element settings and global data.

```json
{
  "headerDisabled": true,
  "scrollSnapType": "y proximity"
}
```

See the [page settings schema](settings/page.json) for all available controls.

**Storage:** Stored as a serialized array in the `wp_postmeta` table.

| Data | Meta key | PHP constant |
|---|---|---|
| Page settings | `_bricks_page_settings` | `BRICKS_DB_PAGE_SETTINGS` |

## Template settings

Settings specific to Bricks templates (stored as the `bricks_template` custom post type). Includes template conditions that determine where on the site a template is applied (e.g., entire website, specific post types, archives, or individual pages). Header templates also store layout settings such as sticky behavior here.

```json
{
  "templateConditions": [
    { "id": "iwjjdg", "main": "any" }
  ]
}
```

See the [template settings schema](settings/template.json) for all available controls.

**Storage:** Stored as serialized arrays in the `wp_postmeta` table.

| Data | Meta key | PHP constant |
|---|---|---|
| Template settings | `_bricks_template_settings` | `BRICKS_DB_TEMPLATE_SETTINGS` |
| Template type | `_bricks_template_type` | `BRICKS_DB_TEMPLATE_TYPE` |

## Global data structures

Bricks stores several global data structures as WordPress options. These are site-wide and shared across all pages and templates.

**Storage:** All global data is stored as serialized arrays in the `wp_options` table.

| Data | Option name | PHP constant |
|---|---|---|
| Global classes | `bricks_global_classes` | `BRICKS_DB_GLOBAL_CLASSES` |
| Global variables | `bricks_global_variables` | `BRICKS_DB_GLOBAL_VARIABLES` |
| Theme styles | `bricks_theme_styles` | `BRICKS_DB_THEME_STYLES` |
| Color palettes | `bricks_color_palette` | `BRICKS_DB_COLOR_PALETTE` |
| Breakpoints | `bricks_breakpoints` | `BRICKS_DB_BREAKPOINTS` |
| Components | `bricks_components` | `BRICKS_DB_COMPONENTS` |
| Pseudo-classes | `bricks_pseudo_classes` | `BRICKS_DB_PSEUDO_CLASSES` |

### Global classes

Reusable CSS class definitions that can be applied to any element via the `_cssGlobalClasses` setting. Edit a class once and every element using it updates everywhere. The `settings` object on a class follows the same structure as element settings, including support for breakpoint and pseudo-class variants using the colon syntax (e.g., `_typography:tablet_portrait`).

```json
[
  {
    "id": "xkatss",
    "name": "hero-section",
    "settings": {
      "_background": {
        "color": {
          "light": "#81D4FA",
          "raw": "var(--bricks-color-sky-blue)",
          "id": "573827"
        }
      },
      "_padding:mobile_portrait": {
        "top": "40",
        "bottom": "40"
      }
    },
    "modified": 1772645626,
    "user_id": 2
  }
]
```

See the [global classes schema](global/global-classes.json).

### Global variables

CSS custom properties that become available site-wide as `var(--variable-name)`. Used to define design tokens (colors, spacing, font sizes, etc.) that can be referenced from any element setting that accepts a CSS value.

```json
[
  { "id": "jeeawn", "name": "primary-color", "value": "green" },
  { "id": "ab3kxz", "name": "spacing-xl", "value": "80px" }
]
```

See the [global variables schema](global/global-variables.json).

### Theme styles

Site-wide default styling applied per element type (e.g., default section padding, heading typography, button colors). Each theme style requires conditions to determine which pages it applies to. Multiple theme styles can coexist with different conditions; a loading method setting controls whether only the most specific or all matching theme styles are applied on a given page.

```json
{
  "my-theme-style": {
    "label": "My Theme Style",
    "settings": {
      "conditions": {
        "conditions": [
          { "id": "vrniaa", "main": "any" }
        ]
      },
      "section": {
        "padding": { "top": "80", "right": "16", "left": "16", "bottom": "80" },
        "_rowGap": "32"
      },
      "heading": {
        "_typography": { "font-family": "Inter", "font-weight": "700" }
      }
    }
  }
}
```

See the [theme styles schema](global/theme-styles.json).

### Color palettes

Named color collections used across the builder. Multiple palettes can coexist. Each color stores a CSS variable reference (`raw`), the resolved light-mode value (`light`), and an optional dark-mode value (`dark`). The `raw` value is what gets written into settings; `light`/`dark` are the resolved display values.

```json
[
  {
    "id": "58e6a6",
    "name": "Brand Colors",
    "colors": [
      { "id": "920e35", "raw": "var(--bricks-color-red)", "light": "#f44336" },
      { "id": "58c724", "raw": "var(--bricks-color-blue)", "light": "#2196f3" },
      { "id": "3f6995", "raw": "var(--bricks-color-green)", "light": "#4caf50" }
    ]
  }
]
```

See the [color palettes schema](global/color-palettes.json).

### Breakpoints

Responsive breakpoint definitions. The entry marked `"base": true` is the default breakpoint; settings with no breakpoint suffix apply at this breakpoint (e.g., `_typography`). All other breakpoints generate a media query at their `width` value and are referenced via colon suffix on the setting key (e.g., `_typography:tablet_portrait`). Users can add custom breakpoints and modify widths.

```json
[
  { "base": true, "key": "desktop", "label": "Desktop", "width": 1279, "icon": "laptop" },
  { "key": "tablet_portrait", "label": "Tablet portrait", "width": 991, "icon": "tablet-portrait" },
  { "key": "mobile_landscape", "label": "Mobile landscape", "width": 767, "icon": "phone-landscape" },
  { "key": "mobile_portrait", "label": "Mobile portrait", "width": 478, "icon": "phone-portrait" }
]
```

See the [breakpoints schema](global/breakpoints.json).

### Components

Reusable element bundles, analogous to components in Vue or React. A component definition holds a tree of elements (`elements`) and an optional list of `properties` that expose specific controls for per-instance customization (e.g., a different heading text or image on each instance). When added to a page, a component instance is created that references the main component via `cid`.

```json
[
  {
    "id": "fdqkmn",
    "category": "Marketing",
    "desc": "A reusable CTA button with configurable label",
    "elements": [
      {
        "id": "fdqkmn",
        "name": "button",
        "parent": 0,
        "children": [],
        "settings": { "text": "Get started", "style": "dark" },
        "label": "CTA Button"
      }
    ],
    "properties": [
      {
        "id": "pbutxt",
        "label": "Button text",
        "type": "text",
        "connections": { "fdqkmn": ["text"] }
      }
    ],
    "_created": 1772645617,
    "_user_id": 2,
    "_version": "2.2-rc2"
  }
]
```

See the [components schema](global/components.json).

### Pseudo-classes

CSS pseudo-classes available in the builder for state variants (e.g., hover, active, focus). These determine which pseudo-class suffixes can be applied to CSS settings using the colon syntax (e.g., `_typography:mobile_portrait:hover`). The defaults are `:hover`, `:active`, and `:focus`, but users can add custom pseudo-classes via Bricks settings.

```json
[":hover", ":active", ":focus"]
```

See the [pseudo-classes schema](global/pseudo-classes.json).

## Nesting example

Below is a real-world hero section showing how elements nest via the flat array structure. The tree view shows the visual hierarchy, followed by the actual data.

```
section (Hero Section 06)
  └─ container
       ├─ block (Content Wrapper)
       │    ├─ heading (h1)
       │    ├─ text-basic (Tagline)
       │    ├─ text-basic (Lede)
       │    └─ div (Button Group)
       │         ├─ button
       │         └─ button (outline)
       └─ block (Media Wrapper)
            └─ image (eager, figure)
```

```json
[
  {
    "id": "13877b",
    "name": "section",
    "parent": 0,
    "children": ["65f029"],
    "settings": { "_cssGlobalClasses": ["skznjf"] },
    "label": "Hero Section 06"
  },
  {
    "id": "65f029",
    "name": "container",
    "parent": "13877b",
    "children": ["bf5a3e", "19454c"],
    "settings": { "_cssGlobalClasses": ["ubprdn"] }
  },
  {
    "id": "bf5a3e",
    "name": "block",
    "parent": "65f029",
    "children": ["c85e7f", "dfe903", "436fc0", "9b4d18"],
    "settings": { "_cssGlobalClasses": ["ebvzqj"] },
    "label": "Content Wrapper"
  },
  {
    "id": "c85e7f",
    "name": "heading",
    "parent": "bf5a3e",
    "children": [],
    "settings": {
      "text": "This hero headline is a temporary placeholder",
      "_cssGlobalClasses": ["deprgo"],
      "tag": "h1",
      "type": "hero"
    }
  },
  {
    "id": "dfe903",
    "name": "text-basic",
    "parent": "bf5a3e",
    "children": [],
    "settings": {
      "text": "Tagline",
      "tag": "p",
      "_cssGlobalClasses": ["dzwkrp", "xlqxzg"]
    },
    "label": "Tagline"
  },
  {
    "id": "436fc0",
    "name": "text-basic",
    "parent": "bf5a3e",
    "children": [],
    "settings": {
      "text": "While we're still finalizing our content, we've included this placeholder text to occupy the space temporarily.",
      "tag": "p",
      "_cssGlobalClasses": ["vpsyry", "ebhacb"]
    },
    "label": "Lede"
  },
  {
    "id": "9b4d18",
    "name": "div",
    "parent": "bf5a3e",
    "children": ["15596e", "c19a95"],
    "settings": { "_cssGlobalClasses": ["zoyzsf"] },
    "label": "Button Group"
  },
  {
    "id": "15596e",
    "name": "button",
    "parent": "9b4d18",
    "children": [],
    "settings": { "text": "Button" }
  },
  {
    "id": "c19a95",
    "name": "button",
    "parent": "9b4d18",
    "children": [],
    "settings": { "text": "Button Outline", "outline": true }
  },
  {
    "id": "19454c",
    "name": "block",
    "parent": "65f029",
    "children": ["849138"],
    "settings": { "_cssGlobalClasses": ["vxsvbb"] },
    "label": "Media Wrapper"
  },
  {
    "id": "849138",
    "name": "image",
    "parent": "19454c",
    "children": [],
    "settings": {
      "tag": "figure",
      "caption": "none",
      "image": {
        "id": 90346,
        "filename": "image_16-9_portrait.jpg",
        "size": "medium_large",
        "full": "https://example.com/wp-content/uploads/image_16-9_portrait.jpg",
        "url": "https://example.com/wp-content/uploads/image_16-9_portrait-768x1365.jpg"
      },
      "_cssGlobalClasses": ["zqibqu"],
      "loading": "eager"
    },
    "label": "Media",
    "themeStyles": []
  }
]
```

## Schema categories

### [Elements](elements/accordion.json)

Individual element schemas describing the settings, metadata, and value types for each element type. 175 element schemas available.

#### [Common](elements/common/element.json)

Shared element documentation: the [element schema](elements/common/element.json) (envelope, settings layers, meta-settings, selectors), [element conditions](elements/common/conditions.json) (display conditions with 32 condition keys and comparison operators), and [element interactions](elements/common/interactions.json) (event-driven behavior with triggers, actions, and sub-conditions).

### [General](general/content-area.json)

Foundational data structures: the [content area](general/content-area.json) schema (flat array container, storage, and meta keys).

### [Controls](controls/text.json)

Value schemas for each control type (text, select, checkbox, typography, etc.), describing the shape of data each control produces.

### [Global](global/global-classes.json)

Root schemas for global data structures: global classes, theme styles, components, color palettes, breakpoints, pseudo-classes, and global variables.

### [Settings](settings/page.json)

Page and template settings schemas describing the available settings controls.
