---
name: bricks-nestable-elements
description: "Build or debug native Bricks Slider, Accordion, Tabs, Dropdown, Nav or Offcanvas element nesting and initialization."
---

# Bricks: nestable elements

Nestable elements contain editable child elements. Runtime schemas describe controls and values; they do not necessarily include the complete native child structure.

## Common nestable elements

Source: `includes/elements/*.php` (`public $nestable = true`).

| Element | File | `$name` | Category | Notes |
|---|---|---|---|---|
| Container | `container.php` | `container` | layout | The base layout element; children unrestricted |
| Section | `section.php` | `section` | layout | Extends Container |
| Block | `block.php` | `block` | layout | Extends Container |
| Div | `div.php` | `div` | layout | Extends Container |
| Slider Nestable | `slider-nested.php` | `slider-nested` | media | 3 default slide-blocks with Heading + Button |
| Accordion Nestable | `accordion-nested.php` | `accordion-nested` | general | 2 default items with title/content wrappers |
| Tabs Nestable | `tabs-nested.php` | `tabs-nested` | general | Default tab-button + tab-content pairs |
| Dropdown | `dropdown.php` | `dropdown` | general | Toggle + content |
| Nav Nested | `nav-nested.php` | `nav-nested` | general | Menu builder replacing the non-nestable Nav |
| Offcanvas | `offcanvas.php` | `offcanvas` | general | Slide-in panel |
| Back to Top | `back-to-top.php` | `back-to-top` | general | Icon + text children default |
| Slot | `slot.php` | `slot` | general | Component slot: renders children passed by the parent component instance |

**The non-nestable counterparts still exist**: "Slider," "Accordion," and "Tabs" use repeater controls instead of child elements. Use the nestable versions when each item needs arbitrary Bricks children.

## The child contract

Inspect runtime controls and preserve the native child wrappers, including WooCommerce v2 state children. Obtain structure from a valid existing element, a concrete recipe below, or the installed source; do not infer it from `nestable: true`.

Child-generation methods:
- `get_nestable_item()`: returns the **default item template** (e.g., a Slider's default slide is a Block wrapping a Heading + Button). When you click "Add item" in the builder, this template is cloned.
- `get_nestable_children()`: returns the **full initial children tree** when the element is first added to the page.

Both methods can be overridden per-element. For Slider Nestable, that's `slider-nested.php:1112` and `:1135` respectively.

## Loop-context scope: the outer-level rule

A layout element with query-loop controls repeats **that layout element**, including its child tree. For a nestable widget, choose the child wrapper that represents one item; do not assume the widget parent itself accepts query controls.

For product carousels, keep one non-looping Slider Nestable parent and put the
Posts query on one child slide Block. Put `{post_title}`, `{post_excerpt}`, and other
product content inside that Block. Each query result repeats that slide; other saved
slides remain additional slides, so remove unwanted defaults only within the
requested design scope (`slider-nested.php::render` renders its child elements).

## The "one loop context per level" trap

You cannot nest a Posts loop inside a Posts loop and have the inner loop see the outer post automatically. The inner loop's query runs independently.

When an inner query needs the outer item, inspect the loop context through
`Query::get_loop_object()` using the outer query element ID, then build the intended
query args in a scoped hook. Do not assume the current global post is still the outer
item after the inner query starts. See [bricks-query-loops](../bricks-query-loops/SKILL.md)
for query hooks and context verification.

## Components with data-producing queries

Queries can live inside components in current Bricks. The runtime tracks component context for query loops, including `component_id` on the `Query` instance and `data-query-component-id` on the query trail (`includes/query.php:77`, `includes/elements/base.php:4163-4168`).

Even so, keep data-producing queries at the page or template level when another control needs to target them, such as pagination or Query Filters. Component-owned queries are harder to reason about because the rendered query id can include instance context.

## Slider Nestable specifics

- Each slide is a Block by default. You can change any slide to a Section / Container / Div or wrap in other elements.
- To repeat slides, put the query loop on a child Block.
- Splide powers Slider Nestable. The element enqueues `bricks-splide` and stores options in `data-splide` (`includes/elements/slider-nested.php:10-23`, `:1204-1355`). Not all Splide options are exposed; use the custom options control or a scoped render-attributes hook when you need an option Bricks does not surface.
- Performance: each Slider Nestable initializes its own Splide instance. Heavy pages with many sliders should keep slide markup and images lean, and should be tested after AJAX loop updates because Bricks rebuilds Splide when query results change.

## Accordion Nestable specifics

- Default 2 items, each with a title block + content block.
- State: open/closed is client-side only (no server-side persistence).
- Accessibility: Bricks handles `aria-expanded` and keyboard navigation. Don't add duplicate logic.
- Multiple-open vs single-open is a setting on the parent (`accordionOneAtATime`).

## Tabs Nestable specifics

For a new two-tab widget, read [the native nested fixture](assets/tabs-nested.json).
Use it as `add-element.element`, adapting labels and pane content before insertion.
It omits internal IDs so the nested-input normalizer can generate them. It is not
a persisted flat page array or an entire write request.

Required structure (Bricks 2.4 `tabs-nested.php::get_nestable_children`):

```text
tabs-nested (openTab: "0")
  block (_hidden._cssClasses: "tab-menu", _direction: "row")
    div (_hidden._cssClasses: "tab-title") -> title content
    div (_hidden._cssClasses: "tab-title") -> title content
  block (_hidden._cssClasses: "tab-content")
    block (_hidden._cssClasses: "tab-pane") -> first pane content
    block (_hidden._cssClasses: "tab-pane") -> second pane content
```

Keep these exact class tokens and wrapper relationships; they drive native styling,
ARIA generation and JavaScript pairing. `_hidden._cssClasses` is a runtime virtual
setting and may be absent from the bundled controls snapshot. Keep title/pane order
and counts aligned. Do not manually add active-state classes or duplicate native
ARIA logic. Put converted cards inside each pane, not directly under the Tabs root.


- Two subtrees: tab buttons (one per tab) and tab content (one per tab). Bricks auto-matches by order.
- Custom tab bodies are the primary reason Tabs Nestable exists: the non-nestable Tabs couldn't hold arbitrary content per tab.
- Set the initial active tab with `openTab` (0-indexed; `tabs-nested.php::set_controls`).

## Nav Nested specifics

- Builds navigation as native editable elements; retain an existing WordPress-menu workflow when that matches the site.
- Each menu item is a Link or a Dropdown (another nestable) containing sub-Links or rich content.
- Mobile behavior (hamburger, drawer) configured on the Nav Nested parent.
- Use **bricks-mega-menus** when a Dropdown should become a full-width/rich mega panel.
- If a site already has WordPress menus, place a `nav-menu` element inside Dropdown content or use the WordPress menu-backed path from **bricks-mega-menus**. Nav Nested itself is still an element-tree menu builder.

## Offcanvas specifics

- Separate from popup but similar conceptually. Differences:
  - Offcanvas is an element that can live inline on any page.
  - Popup is a template with its own conditions and frequency limits.
  - Use offcanvas for navigation drawers, cart drawers, filters sidebars.
  - Use popup for promotional modals, confirmations, dialogs.
- Toggle via interactions (`action: toggleOffCanvas`).

## Silent-failure debug order

1. **Nestable renders but no children?**
   a. Check the builder tree: do children exist? If not, insert them (they don't auto-populate after initial add-from-library).
   b. Custom class on the nestable wrapper hiding children (display: none / height: 0).

2. **Looped nestable shows default children instead of looped data?**
   a. The intended child layout element does not have Query Loop enabled.
   b. Query is targeting the wrong element. Check element-specific query settings.

3. **Accordion items not clickable?**
   a. Custom z-index / position elsewhere on the page blocking clicks.
   b. JS error elsewhere preventing Bricks' frontend.js from initializing.

4. **Tabs show all content at once?**
   a. `frontend.js` not loaded: check script enqueue.
   b. Custom CSS on `.brxe-tabs-nested *` overriding `display: none` on inactive panels.

5. **Slider sometimes misaligned on load?**
   a. Splide initialized before images or fonts settled. Set explicit image dimensions and test after AJAX loop updates.
   b. Fonts loading late causing re-flow. Preload fonts.

Verify nested-loop behavior on the frontend after saving.

## MCP write notes

- `add-element` / `update-element` / `remove-element` route writes to the correct meta key for the host post: page content vs header template vs footer template. Pass `postId` and the element ID.
- Element-write abilities reject `query: null` and queries missing `objectType`. If you're seeding a nestable with a query, pass at least `{ objectType: "post", postType: ["post"] }`.
- Link settings on Buttons / Headings / Images are validated at write time: `external` requires a `url`; `internal` requires `postId` or `useDynamicData`. Empty link objects are rejected.
- Dynamic-data tags inside settings are bracket-balance-checked at write time: `{post_title` (missing close) returns an error. Code/CSS/script settings are exempt (they legitimately contain `{`).
