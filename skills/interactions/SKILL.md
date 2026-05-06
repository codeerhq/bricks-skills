---
name: interactions
description: "Use when building or debugging Bricks element interactions: \"make this button open a popup\", \"toggle a class on click\", \"scroll to section\", \"why does my interaction fire twice?\". Covers the 27 element triggers, 18 actions, target-selector rules, global-class inheritance, and infinite-loop traps."
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

# Bricks: interactions

Interactions are the no-code behavior system: per-element `{ trigger, action }` pairs that wire clicks, hovers, scrolls, and form events to DOM mutations, popup opens, offcanvas toggles, and JS callbacks. They're stored on `element.settings._interactions` as an array.

They can also become the biggest performance drag on Bricks pages: a big list of interactions on every product card compounds fast.

## The schema

Storage key: **`_interactions`** on `element.settings`. Array of objects. Each object has fields from `includes/interactions.php:94-491`: 30+ possible keys, most conditional on the trigger/action combination.

Minimum shape:

```json
{
  "id": "abc123",
  "trigger": "click",
  "action": "show",
  "target": "custom",
  "targetSelector": "#my-modal"
}
```

## The 27 element triggers

Authoritative list at `includes/abilities/interactions.php` (`Interactions::TRIGGERS`), sourced from `includes/interactions.php` controls. Popup template interactions add two template-only triggers, `showPopup` and `hidePopup`, under `template_interactions`.

| Trigger | Fires when |
|---|---|
| `click` | Element clicked |
| `mouseover` | Pointer over |
| `mouseenter` | Pointer enters bounding box |
| `mouseleave` | Pointer leaves bounding box |
| `focus` | Element focused (keyboard/tab) |
| `blur` | Focus lost |
| `scroll` | Page scrolled (configurable %/px) |
| `contentLoaded` | DOM ready |
| `mouseleaveWindow` | Exit-intent: pointer exits top of window |
| `enterView` | Element enters viewport |
| `leaveView` | Element leaves viewport |
| `animationEnd` | CSS animation completes |
| `formSubmit` | Form submitted (any form) |
| `formSuccess` | Form submitted + server returned success |
| `formError` | Form returned error |
| `ajaxStart` | Query AJAX loader started |
| `ajaxEnd` | Query AJAX loader completed |
| `filterSubmitStart` | Query filter submit started |
| `filterSubmitEnd` | Query filter submit completed |

Feature-scoped triggers (same const, also accepted by MCP):
- Query filters: `filterSubmitStart`, `filterSubmitEnd`, `filterOptionEmpty`, `filterOptionNotEmpty`
- WooCommerce: `wooAddedToCart`, `wooAddingToCart`, `wooRemovedFromCart`, `wooUpdateCart`, `wooCouponApplied`, `wooCouponRemoved`

## The 18 actions

Authoritative list at `includes/abilities/interactions.php:68-87` (`Interactions::ACTIONS`).

| Action | What it does | Extra keys |
|---|---|---|
| `show` | Unhide target, or open a popup when `target: "popup"` | None, or `templateId` when `target: "popup"` |
| `hide` | Hide target, or close a popup when `target: "popup"` | None, or `templateId` when `target: "popup"` |
| `click` | Programmatic click on target | None |
| `startAnimation` | Trigger a CSS animation | `animationType`, `animationDuration`, `animationDelay` |
| `scrollTo` | Scroll to target | `scrollToOffset`, `scrollToDelay` |
| `setAttribute` | Add/set attribute on target | `actionAttributeKey`, `actionAttributeValue` |
| `removeAttribute` | Remove attribute | `actionAttributeKey` |
| `toggleAttribute` | Toggle attribute presence or value | `actionAttributeKey`, `actionAttributeValue` |
| `toggleOffCanvas` | Open/close an offcanvas element | `offCanvasSelector` |
| `loadMore` | Load next page on a query loop | `loadMoreQuery` |
| `loadMoreGallery` | Same, for image galleries | `loadMoreTargetSelector` |
| `openAddress` | Open Google Maps with a pin | `latitude`, `longitude` |
| `closeAddress` | Close map info box | `infoBoxId` plus map-specific settings |
| `clearForm` | Reset form fields | `targetFormSelector` unless the trigger is a form event |
| `storageAdd` | Write to browser storage | `storageType`, `actionAttributeKey`, `actionAttributeValue` |
| `storageRemove` | Remove from browser storage | `storageType`, `actionAttributeKey` |
| `storageCount` | Increment a counter in browser storage | `storageType`, `actionAttributeKey` |
| `javascript` | Call a named JavaScript function on `window` | `jsFunction`, optional `jsFunctionArgs` |

There is no `openPopup`, `customJs`, or inline `javascript` source field. The `javascript` action calls an existing frontend function by name through `jsFunction` (for example `MyApp.trackCardClick`) and optional `jsFunctionArgs`; it does not evaluate arbitrary JavaScript text. To open a popup with native interaction data, use `action: "show"`, `target: "popup"`, and `templateId`. JavaScript can still call `bricksOpenPopup(id)`, but use the native shape when authoring Bricks data.

## Targets: three modes

Defined at `includes/abilities/interactions.php` (`Interactions::TARGETS`). MCP accepts exactly these three explicit values: `self`, `custom`, `popup`. If `target` is omitted, Bricks treats the interaction as `self` at runtime. Offcanvas open/close is saved as `action: "toggleOffCanvas"`; during render Bricks rewrites it internally to an offcanvas target for frontend handling.

| Mode | Setting | Resolves to |
|---|---|---|
| `self` | `target: "self"` | The element that owns the interaction |
| `custom` | `target: "custom"`, `targetSelector: "#foo"` or `.bar` | CSS selector (querySelector semantics) |
| `popup` | `target: "popup"`, `templateId: 123` | A popup template id |

**Important:** targets are **CSS selectors, not Bricks element IDs**. To target a specific Bricks element by id, use `#brxe-{element_id}`: that's the id Bricks auto-applies to every rendered element. But if you rely on this, the selector breaks if the element is duplicated (new id).

Safer: add a CSS class to the target via the Element ID/Class panel (e.g. `.js-main-nav`), then target `.js-main-nav` from the interaction. Survives element duplication.

## Global-class inheritance: interactions on classes

Interactions can live on a global class (same place as the class's other settings). Every element using that class inherits the interactions (`interactions.php:531-539`).

Merge rule: interactions on an element **stack with** (do not override) interactions on the element's applied classes. So if a button has `click -> show #foo` and the button also has a class with `click -> scrollTo #top`, both fire on click.

**Consequence:** removing an interaction from the button directly doesn't remove class-level interactions. You have to edit the class. If the class-level interaction still fires after an element edit, check the class before assuming interactions are broken.

## Infinite-loop traps

1. **`enterView -> startAnimation` on a scroll-repeating element.** If the animation moves the element out of then back into view, it re-fires. Add `Run once` on the interaction.

2. **`click -> click` on another element that clicks back.** Infinite click loop. Happens often with "link both of these" logic. Add a guard or use a different mechanism.

3. **`formSubmit -> clearForm` with `formSuccess -> submit`.** This creates a loop where the cleared form submits itself again. Set `Run once` and guard.

4. **`storageAdd -> scroll` with `scroll -> storageAdd`.** Storage writes trigger scroll, scroll triggers storage writes. Batch your storage interactions.

## Run-once / frequency

Every interaction has a **Run once** boolean (`runOnce`) and optional **interaction conditions** (`interactionConditions`, defined in `includes/interactions.php`) based on browser storage:

- `windowStorage`: page-load counter
- `sessionStorage`: tab-lifetime counter
- `localStorage`: cross-session counter

With compare operators: `exists`, `notExists`, `==`, `!=`, `>=`, `<=`, `>`, `<`.

Example: "fire at most 3 times per day": add a condition against a local-storage key, then pair it with `storageCount` using `storageType: "localStorage"` and the same key in `actionAttributeKey`.

## Performance cost

Every interaction adds:
- Event listener(s) at DOM-ready.
- JSON payload in `data-interactions` attribute (shipped inline per element).
- Per-fire work: target lookup, condition check, action execution.

On a product archive with 100 cards x 5 interactions each = 500 listeners + 500 JSON blobs inline. Page size and initial JS cost both balloon.

**When it's a problem:** TTI > 3s, or FID / INP above Google's thresholds on mobile.

**Fixes (in order):**
1. Move reusable behavior into a global class, or into a small enqueued JS handler if you need true delegated trigger matching. Bricks interactions target selectors for actions; they do not provide a selector-based delegated trigger model.
2. Put interactions on the global class the card uses, not on each card instance (reduces JSON duplication).
3. For simple CSS-only behaviors (hover color change, scale), drop the interaction and use a pseudo-class. Interactions are overkill for CSS.
4. Put heavy `javascript` action functions in a proper enqueued JS file and reference them by `jsFunction`, so the behavior is browser-cached and reusable.

## Hooks

Few dedicated interaction hooks exist. For render-attribute level tweaks, use the element-render hooks (`bricks/element/render_attributes`). For popup-related interaction behavior, use `bricks/popup/attributes`.

Interactions are largely frontend-only. WPML-aware behavior for popup interactions is handled at `interactions.php:585-600, 688-705` (popup template id translation).

## Silent-failure debug order

1. **Interaction doesn't fire?**
   a. DevTools Elements -> find the element -> check `data-interactions` attribute. Is your interaction in the JSON? No -> saved state doesn't match builder. Resave.
   b. Check browser console for errors. A JS-action snippet with a syntax error silently breaks the whole interaction parser on that element.
   c. Trigger mismatch: `click` on a disabled button, `scroll` on a non-scrolling container.

2. **Interaction fires but target isn't affected?**
   a. Target selector is wrong. Test `document.querySelectorAll("your-selector")` in the console.
   b. Target doesn't exist yet at trigger time (e.g., targeting an element inside a popup before the popup renders).

3. **Fires too many times?**
   a. Class-level interaction duplicating element-level. Check the applied classes.
   b. Missing `runOnce`. Enable it.
   c. One of the infinite-loop traps above.

4. **Fires on wrong elements?**
   a. Selector too broad. `.btn` matches every button on the page.
   b. Global class interaction applies to more elements than you expected.

5. **Works in builder, fails on frontend (or vice versa)?**
   a. Interaction references a popup template id that doesn't render in the builder context.
   b. Trigger is a frontend-only event (`formSubmit`): builder doesn't submit real forms.

## MCP abilities for interactions

- `get-element-interactions`: read an element's `_interactions` array.
- `update-element-interactions`: replace interactions on an element. It validates element-level triggers only. Popup template-level `showPopup` and `hidePopup` live in popup template settings as `template_interactions`.

## Never do

- Target elements by auto-generated Bricks id (`#brxe-xyz`) in production: they change on duplication.
- Stack 10+ interactions on a single element. Refactor to event delegation or CSS.
- Use `javascript` action for anything reusable: write it in a child theme as an enqueued JS function and call that.
- Put form-submit interactions on the Form element itself without `runOnce`: they fire on every validation failure, not just success.
- Forget that class-level interactions stack with element-level interactions.
- Pair `scrollTo` on an element's `click` with the element itself being the scroll target: instant infinite loop.
