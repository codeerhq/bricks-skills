---
name: nestable-elements
description: "Use when building or debugging Bricks Slider/Accordion/Tabs/Dropdown/Nav/Offcanvas: \"build a product carousel\", \"my tabs aren't rendering children\", \"add items to this accordion\". Covers the 12 nestable elements, child-element contracts, loop-context scope, and component/query boundaries."
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

# Bricks: nestable elements

A **nestable element** is one whose children are full Bricks elements (not a repeater-based config). The parent renders a wrapper; each child is free to be any element type. Sliders, Accordions, Tabs, Navs: anything with "repeatable sections of freeform content" is nestable.

## The 12 nestable elements

Found by grepping `public $nestable = true` in `includes/elements/*.php` (property defined in base `Element` class).

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

There's **no `$allowed_children` property** in Bricks. A nestable doesn't restrict which element types can be children: any Bricks element is fair game.

What nestables do provide:
- `get_nestable_item()`: returns the **default item template** (e.g., a Slider's default slide is a Block wrapping a Heading + Button). When you click "Add item" in the builder, this template is cloned.
- `get_nestable_children()`: returns the **full initial children tree** when the element is first added to the page.

Both methods can be overridden per-element. For Slider Nestable, that's `slider-nested.php:1112` and `:1135` respectively.

## Loop-context scope: the outer-level rule

A nestable element with query-loop enabled loops **the element itself**, not its children. The outer wrapper renders N times, each containing the original child tree.

Children inside a looped nestable can access the loop's current post/term/user via standard dynamic tags. In builder mode, Bricks has special handling for the first loop node preview text and intentionally excludes nestable elements from that preview-text capture:

From `includes/builder.php:1825-1827`:
```php
Query::is_any_looping() && Query::get_looping_level() === 0 && ! $instance->nestable
```

That does not mean nestable children are skipped. The actual loop render still goes through `Query::render( 'Bricks\Frontend::render_element', ... )` in the element render path. Treat builder preview differences as possible, and verify looped nestables on the frontend.

For product carousels:
- Outer: Slider Nestable with Posts query.
- Each slide: a Block with `{post_title}`, `{post_excerpt}`, etc.: all bound to the current post.
- The default 3 slides act as a *template*: the loop overrides them with N slides from the query.

## The "one loop context per level" trap

You cannot nest a Posts loop inside a Posts loop and have the inner loop see the outer post automatically. The inner loop's query runs independently.

To use the outer post as a query arg inside the inner loop, inject via a hook:

```php
add_filter( 'bricks/posts/query_vars', function( $args, $settings, $element_id ) {
    if ( $element_id === 'inner-loop-element-id' ) {
        $args['post__in'] = get_field( 'related_posts', 'current_post_id_somehow' );
    }
    return $args;
}, 10, 3 );
```

But "current post somehow" is the hard part: the hook doesn't know the outer loop iteration. You need `Query::get_loop_object()` from inside the filter, scoped to the outer loop's element id.

This is the "component-contains-query-that-needs-outer-context" problem. See `query-loops` skill.

## Components with data-producing queries

Queries can live inside components in current Bricks. The runtime tracks component context for query loops, including `component_id` on the `Query` instance and `data-query-component-id` on the query trail (`includes/query.php:77`, `includes/elements/base.php:4163-4168`).

Even so, keep data-producing queries at the page or template level when another control needs to target them, such as pagination or Query Filters. Component-owned queries are harder to reason about because the rendered query id can include instance context.

## Slider Nestable specifics

- Each slide is a Block by default. You can change any slide to a Section / Container / Div or wrap in other elements.
- Looping a Slider Nestable: the Slider is the loop owner, each iteration produces one slide. The `nestable_children` default (3 slides) becomes the template for what-each-looped-slide-looks-like.
- Splide powers Slider Nestable. The element enqueues `bricks-splide` and stores options in `data-splide` (`includes/elements/slider-nested.php:10-23`, `:1204-1355`). Not all Splide options are exposed; use the custom options control or a scoped render-attributes hook when you need an option Bricks does not surface.
- Performance: each Slider Nestable initializes its own Splide instance. Heavy pages with many sliders should keep slide markup and images lean, and should be tested after AJAX loop updates because Bricks rebuilds Splide when query results change.

## Accordion Nestable specifics

- Default 2 items, each with a title block + content block.
- State: open/closed is client-side only (no server-side persistence).
- Accessibility: Bricks handles `aria-expanded` and keyboard navigation. Don't add duplicate logic.
- Multiple-open vs single-open is a setting on the parent (`accordionOneAtATime`).

## Tabs Nestable specifics

- Two subtrees: tab buttons (one per tab) and tab content (one per tab). Bricks auto-matches by order.
- Custom tab bodies are the primary reason Tabs Nestable exists: the non-nestable Tabs couldn't hold arbitrary content per tab.
- Initial active tab is `activeTab` setting (0-indexed).

## Nav Nested specifics

- Replaces the old Nav element for all new sites.
- Each menu item is a Link or a Dropdown (another nestable) containing sub-Links or rich content.
- Mobile behavior (hamburger, drawer) configured on the Nav Nested parent.
- Use **mega-menus** when a Dropdown should become a full-width/rich mega panel.
- If a site already has WordPress menus, place a `nav-menu` element inside Dropdown content or use the WordPress menu-backed path from **mega-menus**. Nav Nested itself is still an element-tree menu builder.

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
   a. Outer nestable doesn't have Query Loop enabled.
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

## Never do

- Expect nestables inside non-nestables to loop the parent. Only nestables with "Use Query Loop" loop.
- Put a data-source query inside a component. Move it up to the page.
- Rely on builder preview for nested-loop behavior. Always verify on frontend.
- Duplicate a nestable to make variants of each slide: use the loop's per-iteration dynamic data instead.
- Nest more than 2 levels of nestables (Tabs -> Slider -> Accordion) without an explicit UX reason. It's confusing to edit and often janky to render.

## MCP write notes

- `add-element` / `update-element` / `remove-element` route writes to the correct meta key for the host post: page content vs header template vs footer template. You don't have to think about meta keys; pass `postId` and the element id and the write goes to the right tree.
- Element-write abilities reject `query: null` and queries missing `objectType`. If you're seeding a nestable with a query, pass at least `{ objectType: "post", postType: ["post"] }`.
- Link settings on Buttons / Headings / Images are validated at write time: `external` requires a `url`; `internal` requires `postId` or `useDynamicData`. Empty link objects are rejected, not silently saved.
- Dynamic-data tags inside settings are bracket-balance-checked at write time: `{post_title` (missing close) returns an error rather than persisting a literal-text bug. Code/CSS/script settings are exempt (they legitimately contain `{`).
