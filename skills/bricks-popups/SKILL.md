---
name: bricks-popups
description: "Use when building or debugging Bricks popups: \"add a newsletter popup\", \"show popup on exit intent\", \"why doesn't my popup show?\", \"popup shows every page load\". Covers trigger types, display conditions, frequency limits, the `bricksOpenPopup` JS API, and triggers-vs-conditions (two separate systems)."
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

# Bricks: popups

A popup in Bricks is a **template with `_bricks_template_type = popup`**. It is not a normal element. Create the popup template first, then wire triggers, display conditions, frequency limits, and any JS control around that template.

## The storage shape

- **Template type:** `popup`: stored as `_bricks_template_type` post_meta on a Bricks template post (`includes/templates.php:1053-1062`). Canonical string: `'popup'`.
- **Content:** the popup's inner element tree lives on the template post's `_bricks_page_content_2` meta (same as any Bricks template).
- **Settings:** popup settings live inside the template settings object stored in `_bricks_template_settings`, not as individual post meta rows. `Helpers::get_template_settings()` and `Helpers::set_template_settings()` read and write this object.

Key template setting keys:

| Setting key | Purpose |
|---|---|
| `popupCloseOn` | `backdrop`, `esc`, or `none`. If no value is saved, the frontend uses the default `backdrop-esc` behavior (`includes/popups.php`) |
| `popupBodyScroll` | Presence flag: `true` enables body scroll while open; unset/false removes the flag (`includes/popups.php:124-129`) |
| `popupAjax` | Presence flag: `true` AJAX-loads content per trigger instead of inline; unset/false removes the flag (`includes/popups.php:182-187`) |
| `popupLimitWindow` | Per-page-load limit count (`includes/popups.php:525-556`) |
| `popupLimitSessionStorage` | Per-session limit count |
| `popupLimitLocalStorage` | Cross-session limit count |
| `popupLimitTimeStorage` | Hours until popup can show again |
| `popupIsInfoBox` | Boolean: popup is used as a map info-box (`includes/popups.php:160-165`) |

These keys sit next to generic template settings in the same settings object. Through MCP, `popupCloseOn` must be a single scalar value: `backdrop`, `esc`, or `none`; pass `null`, `false`, or an empty string to unset optional popup settings.

## Triggers vs display conditions: two separate systems

This is the most-confused pair in Bricks.

**Triggers (when)**: what action on the page fires the popup.
- Stored on the **element that triggers the popup** (not on the popup itself), via the Interactions system.
- Example: a button has an interaction with `trigger: "click"`, `action: "show"`, `target: "popup"`, and `templateId` set to the popup template id.
- Defined at `includes/interactions.php:46-86`.

**Display conditions (where)**: whether the popup is eligible to show on the current page at all.
- Stored on the **popup template**, under Template settings -> Conditions. It uses the same condition schema as templates: `any`, `frontpage`, `postType`, `archiveType`, `search`, `error`, `terms`, `ids`, and `hook`.
- A popup with no matching conditions is not included in `Database::$active_templates['popup']`, so its DOM is not rendered on normal page loads.
- Defined in the template-conditions subsystem (see `bricks-templates-conditions` skill).

**The "no conditions = no fire" trap:**
A popup with *no display conditions set* will not fire automatically because it is not rendered into the page in the normal popup collection. `bricksOpenPopup(id)` only works after matching conditions or another rendering path places the popup DOM on the page. A popup with `trigger: contentLoaded` still needs matching display conditions.

**The correct flow for a page-load popup on the home page:**
1. Create a template, type = popup, with content.
2. Add an interaction with `trigger: "contentLoaded"`, `action: "show"`, `target: "popup"`, and `templateId` set to the popup template id.
3. Also set display conditions: where = home page. Use `{ main: "frontpage" }` for the front page or `{ main: "any" }` for site-wide eligibility.

## Trigger types (interaction-style)

From `includes/interactions.php` and `includes/settings/settings-template.php`. Popup openers use normal interactions with `action: "show"` and `target: "popup"`. Popup templates can also use template-level lifecycle triggers, `showPopup` and `hidePopup`, in `template_interactions`.

| Trigger | Fires when |
|---|---|
| `contentLoaded` | Page DOM-ready |
| `scroll` | Page scrolled (configurable % or px) |
| `click` | Element clicked |
| `mouseenter` / `mouseleave` / `mouseover` / `focus` / `blur` | Pointer / focus events |
| `mouseleaveWindow` | Exit-intent (pointer leaves top of window) |
| `enterView` / `leaveView` | Element enters/leaves viewport |
| `animationEnd` | A CSS animation finished on the element |
| `formSubmit` / `formSuccess` / `formError` | Form events |
| `ajaxStart` / `ajaxEnd` | Query AJAX loader lifecycle |
| `filterSubmitStart` / `filterSubmitEnd` | Query filter submit lifecycle |
| `showPopup` / `hidePopup` | Popup-template lifecycle triggers only. They are stored in popup template settings as `template_interactions`, not on normal element interactions. |
| `filterOptionEmpty` / `filterOptionNotEmpty` | Query-filter options (conditional) |
| `wooAddedToCart` / `wooAddingToCart` / `wooRemovedFromCart` / `wooUpdateCart` / `wooCouponApplied` / `wooCouponRemoved` | WooCommerce events (conditional) |

**Popup opening is an interaction action:**
- On any rendered element, use an interaction with `action: "show"`, `target: "popup"`, and `templateId` set to the popup template id.
- `toggleOffCanvas` is for off-canvas elements, not the normal popup template target.
- A JavaScript action that calls `bricksOpenPopup(POPUP_ID)` is still valid, but the native interaction shape is the first choice when authoring Bricks data.

## Frequency limits: the four layers

Bricks exposes 4 frequency counters per popup (stored in browser state by popup id):

| Layer | Key | Lifetime | Use for |
|---|---|---|---|
| Page-load | `window.brx_popup_{id}_total` | Single page navigation | "Show once per page" |
| Session | `sessionStorage.brx_popup_{id}_total` | Browser tab closed | "Show once per session" |
| Local | `localStorage.brx_popup_{id}_total` | Cleared only by user | "Show once forever" |
| Time | `localStorage.brx_popup_{id}_lastShown` | Hours configured | "Show once every N hours" |

Configured on the popup template's settings (`popupLimit*` keys). `popupLimitTimeStorage` is the hours-TTL for the time layer.

The limit check runs in `bricksPopupCheckLimit()` (`frontend.js:10711-10760`) before `bricksOpenPopup()` proceeds.

**Dev-mode reset:** clear `localStorage` + `sessionStorage` in DevTools to retest a popup from a clean state. If you don't, the popup will refuse to open on a fresh load and it looks like the code is broken.

## JS API: programmatic control

Defined in `frontend.js:10334-10410` and `:10651-10699`.

```js
bricksOpenPopup( popupIdOrDomNode, timeout = 0, additionalParam = {} );
bricksClosePopup( popupIdOrDomNode );
```

- First arg: the template **post id** (integer) or the already-rendered DOM node.
- `timeout`: milliseconds before the open actually fires. Bricks adds animation-duration automatically; use this for deliberate extra delay.
- `additionalParam`: only used when `popupAjax` is on. Use `popupContextId` and `popupContextType` to set the render context explicitly, or let Bricks derive loop context from `loopId`.

Common patterns:

```js
// Open via id
bricksOpenPopup( 123 );

// Open with 2-second delay
bricksOpenPopup( 123, 2000 );

// Open AJAX popup with post context (e.g. product quick-view)
bricksOpenPopup( 123, 0, { popupContextId: currentProductId, popupContextType: 'post' } );

// Close
bricksClosePopup( 123 );
```

**Don't use jQuery `.trigger('click')` to open**: it bypasses the frequency check and the AJAX lifecycle.

## AJAX popups: the context gotcha

`popupAjax` mode renders popup content server-side per-trigger. That means dynamic tags inside the popup resolve against the AJAX request's context, not the page that triggered it.

- Without an explicit context, dynamic tags like `{post_title}` use the current page context or the loop context Bricks can derive from `loopId`.
- Pass the context you want as `additionalParam`: `bricksOpenPopup(id, 0, { popupContextId: 42, popupContextType: "post" })`. Supported context types are `post`, `term`, and `user` (`popupContextType`).
- AJAX popups are slower than inline popups: use for heavy content or per-item previews, not for a global newsletter popup.

## Display-condition cascades

A popup can have display conditions like any template. Rules for how they evaluate:

- Conditions are the same flat OR array used by Bricks templates. Any matching condition can make the popup eligible.
- Exclude conditions can remove the popup from a context that would otherwise match.
- If the popup has conditions but the current page doesn't match any, the popup is not rendered into the DOM. `bricksOpenPopup(id)` returns without opening because there is no popup node to target.

For "usable everywhere via JS": set conditions to `{ main: "any" }`.

## Silent-failure debug order

1. **Popup doesn't show on expected trigger?**
   a. Open DevTools -> Application -> Local Storage + Session Storage -> look for `brx_popup_{id}_*`. Clear them. Retry.
   b. Check the popup template's display conditions: does the current page match?
   c. Check the page DOM for `.brx-popup[data-popup-id="POPUP_ID"]`. If it is absent, conditions do not match or the popup was not rendered by another path.

2. **Popup opens but content is stale / wrong post?**
   a. AJAX mode + missing `additionalParam.popupContextId`. Pass the context with `popupContextType` when needed.

3. **Popup opens twice?**
   a. Two interactions both calling `bricksOpenPopup(id)`. Or a popup with `contentLoaded` trigger *and* a button `click -> open popup` on the same page: both fire.

4. **`bricksOpenPopup(id)` silently does nothing?**
   a. The popup template is not rendered on this page (no matching conditions). Grep `.brx-popup[data-popup-id="{id}"]` in the page source: if absent, conditions don't match.
   b. Frequency limit already hit. Clear storage.
   c. Popup id doesn't exist (typo / deleted template).

5. **Exit-intent popup fires on mobile?**
   a. It shouldn't: `mouseleaveWindow` only fires on desktop. If it does, a different trigger is wired in too.

6. **Popup rendered but not visible?**
    a. CSS specificity issue: something else has a higher z-index. Bricks popups use `z-index: 10000` by default, unless `popupZindex` or CSS overrides it; check for other overlays.
   b. Animation never completes: element has `display: none` stuck. Check DevTools -> Elements for the popup's `.brx-popup` root.

## MCP abilities for popups

- `list-popups`: enumerate every popup template on the site with display-condition summary.
- `get-popup-config`: full config of one popup (content tree + settings).
- `update-popup-settings`: change popup-specific template settings, including frequency, AJAX loading, close behavior, and template-level `template_interactions`. Use `set-template-conditions` for display conditions and `update-element-interactions` for opener elements.

## Never do

- Build a popup by dragging elements onto a page and expecting to "make it a popup": it has to be a template with `_bricks_template_type = popup`.
- Skip display conditions and assume the popup will "just show." With no matching conditions, the popup is not rendered into the normal page DOM.
- Use `bricksOpenPopup()` without checking `bricksPopupCheckLimit()` first when you want deliberate bypass: the limit is there so users aren't spammed.
- Forget to clear local/session storage when testing frequency-limited popups: you'll blame broken code.
- Put a form inside a popup without a success-state or close behavior: users submit and may not see what happened.
- Assume `contentLoaded` = instant. It's DOM-ready, which on slow networks can be seconds after the user perceives the page as loaded.
