---
name: bricks-browser-verify
description: "Inspect a Bricks page in a browser, compare it with a design or baseline, or verify a completed change. Inspection requests remain read-only."
---

**Requires:** Bricks 2.4+ with the Abilities API enabled

# Bricks: browser verification

Verify the requested page and state with the browser tools available in the client.
Builder preview and the public frontend can differ in authentication, template/query
context, CSS loading, caching and JavaScript initialization.

## Resolve the target and scope

- Use a supplied frontend URL or post ID. Otherwise use `bricks/find-post` with the
  user's title/slug and inspect status/access before choosing a result.
- `create-post` returns a permalink; `find-post` currently returns builder metadata
  without a public permalink. Resolve an existing page's URL from an available
  WordPress source or verified permalink structure. `builderUrl` is the edit route.
- No match does not prove nonexistence. Check lookup/status scope, then ask for the
  page ID or preview link if identity remains unresolved. Do not create a substitute.
- For a draft, use a valid authenticated preview. Do not publish or republish it to
  make verification easier.
- “Check and tell me what's wrong” authorizes inspection. “Fix these problems”
  authorizes repairs within that scope. Verification after a build can include
  corrections needed to finish that already-authorized build.

Without a browser, continue useful scoped reads of persisted elements, settings,
references and `render-elements` output. State that visual/interactive behavior is
unverified. Ask for screenshots only when they would resolve the remaining task.

## Inspect relevant states

| Request | Evidence |
|---|---|
| Match a design | Same viewport, content and font readiness; compare hierarchy, geometry, typography, images and intentional differences |
| Responsive review | Actual `list-breakpoints` keys, widths and direction; requested widths and relevant transition boundaries, including overflow |
| Regression check | Comparable before/after state; without a baseline report current defects rather than claiming no regressions |
| Menu, popup, tabs or accordion | Initial, opened/selected and closed states; keyboard activation, focus movement/return and relevant ARIA state |
| Query/filter/Load More | Expected records, empty state, changing selection and pagination; wait for the actual asynchronous result |
| Performance | Measure the symptom with available network/timing tools; use **bricks-performance** for diagnosis |

Use observed URLs/selectors and the actual browser API, not invented universal tool
names. Wait for meaningful readiness rather than a fixed delay. Do not submit forms,
place orders or activate external side effects merely to inspect layout; use an
authorized test flow when functional execution is part of the request.

Describe discrepancies with a target and location. A screenshot does not prove
native editability, working interactions or accessibility. Pixel tolerances depend
on the brief; no fixed five-pixel threshold proves completion.

## Repair within the requested scope

Read the affected element's settings, classes and responsive overrides; obtain the
specific runtime controls before changing it. Prefer a focused `update-element` or
same-post batch for local repairs. A mismatch in one card does not establish that its
shared class/global variable is wrong everywhere. Change a shared resource only
when the intended scope includes its other uses, retaining ownership/digest guards.

Inspect mutation readback for saved values, normalization and partial state; use a
focused read when those facts are missing. Revisit the affected states. Preserve
unrelated settings, elements and resources. Use **bricks-quality-gate** for broad or
uncertain writes.

## Diagnose missing or stale output

- Blank page: verify URL, draft access, response status and rendering errors.
- Builder UI: resolve the frontend/preview route.
- Old CSS: inspect loaded files/inline styles and persisted settings. Reload through
  supported browser controls. Regeneration/cache purging is a scoped repair, not an
  automatic read-only review step. Do not toggle global CSS loading as a shortcut.
- Different preview values: compare authentication, preview post, loop row,
  conditions and template selection.
- Repeated attempts without new evidence: stop the ineffective loop and pursue the
  relevant diagnostic. Do not blame a plugin/server merely because three tries failed.

Report checked URL/status, viewports/states, findings and verification limits. List
fixes separately from observations when fixes were authorized.

## Agency field notes

Deltas carried from the agency fork (vendor 0.1.3 does not contain them). Upstream these rather than editing the sections above.

No new Bricks abilities here. This workflow composes existing abilities. It sequences the Bricks post abilities (`find-post`, `create-post`, `get-page-elements`, `update-element`) with whatever browser tool is available in the current client.
If no browser tool is available, stop at "resolve URL" and hand the URL back to the user.

### Why verify

Bricks' builder preview **isn't always the frontend**. Common drift sources:
- Custom CSS with context scoping (`body.logged-in`) differs between builder (always logged-in) and frontend visitor (not).
- Cache plugins serving stale CSS to front-end visitors.
- Query loops behaving differently per context (admin query vs public query).
- Dynamic-data values resolving to different values (admin sees drafts, frontend doesn't).
- Lazy-loaded images below the fold not firing in builder preview's viewport.
- Interactions / JS not running in builder-preview context.
The builder is a development surface. Frontend is truth. Always verify.

### Verify proportionately

Screenshots and browser round-trips are the slowest part of the loop — size the effort to the task:
- **Scalar settings-only writes** (padding value, color, font size — nothing structural or visual): no screenshot needed. Confirm via post-write readback of element settings (`get-page-elements`) and, where the value flows through dynamic data or CSS, a cheap text/DOM check.
- **curl / DOM / text checks first** where sufficient: "is the CTA label right?", "is the srcset missing?", "does the meta description match?" — a curl of the rendered HTML or a DOM query answers faster than a screenshot.
- **One relevant viewport by default**: screenshot at the width matching the device/task (mobile nav check → 375px; desktop hero → 1440px). Run the full mobile/tablet/desktop set only when responsive behavior is in scope.
- **Cap visual iteration at 2 screenshot/fix rounds**: fix, re-screenshot once, confirm. If it doesn't converge after 2 rounds, stop and report the blocker instead of looping. Only continue past the cap when the user explicitly asked for design iteration or visual comparison (e.g. pixel-match against a Figma frame).
- Screenshots are comparatively heavy next to plain reads — treat that as a rough project-level estimate of round-trip cost, not a universal technical constant.

### Step 1: Resolve the frontend URL

find-post({ postType: "page", query: "Home" })
// -> returns { results: [{ id, title, slug, path, postType, status, builderUrl, ... }], total }
create-post({ postType: "page", title: "Pricing" })
// -> returns { postId, title, slug, postType, status, builderUrl, permalink, ... }
Use `create-post`'s `permalink` directly. For existing posts found through `find-post`, use the returned `builderUrl` only when you intend to inspect the builder route. If you need the public frontend URL, derive it from the site's permalink structure or another WordPress source; current `find-post` output does not include `permalink`.
If the post doesn't exist:
create-post({ postType: "page", title: "Test", status: "draft" })

### Step 2: Open in the browser

Use the browser tool available in the current client. Tool names vary, but you need these operations:
- Navigate to the public permalink.
- Resize the viewport for responsive checks.
- Click or evaluate JavaScript when testing interactions.

### Step 2: Open in the browser


#### Dimensions

Default viewport is often 1280x720. For responsive checks:
browser.resize({ width: 375, height: 667 })   // mobile
browser.resize({ width: 768, height: 1024 })  // tablet
browser.resize({ width: 1440, height: 900 })  // desktop
Match Bricks' default breakpoints: desktop base `1279`, tablet portrait `991`, mobile landscape `767`, and mobile portrait `478` (`includes/breakpoints.php`).

### Step 3: Compare

Review the screenshot as image input. Describe the expected output:
- From a target design (Figma frame, mock, screenshot-before)
- From a specification ("the hero should have a white background, 48px heading, centered")
- From a prior screenshot ("did anything break since the last save?")
> "The pricing card's border-radius looks ~4px but the design shows 12px."
> "The CTA button is left-aligned; should be center."
> "The hero image fills width but the design shows max-width 1200px with side padding."
Vague observations ("looks off") don't lead to actionable fixes.

### Step 4: Identify the element

For each mismatch, find the element in the Bricks tree:
get-page-elements({ postId: 42 })
// -> returns the element tree with IDs, types, settings
Search the tree for the element matching the mismatch. Common signals:
- An Image element with `_root` settings mentioning the hero URL.
- A Heading element with the target text.
- A Container element with the class the mismatch relates to.

### Step 5: Fix

_padding: { top: "64px", bottom: "64px", left: "24px", right: "24px" }
For style changes via global variables / theme styles, don't edit the element: edit the variable:
variables: [ { id: "<existing-id>", name: "radius-md", value: "12px", category: "<existing-category-id>" } ],
Here `globals` is one fresh `list-global-variables` response. Preserve the full
existing row (including opaque supported fields) and change only the intended value.
One global change > many element edits.

### Step 6: Re-screenshot

Verify the change landed. Iterate on remaining mismatches.
- Hard-reload if CSS changes don't appear. Cache layer may serve stale CSS.
- Wait ~500ms if animations are involved (hero image fade-in).
- For AJAX-loaded content (query filters, Load More), trigger the interaction before screenshot.

### Step 6: Re-screenshot


#### Cache-busting

Bricks caches element CSS per-page in `wp-content/uploads/bricks/css/`. Hard reload often solves stale styles:
browser.evaluate({ code: "location.reload(true)" })
// or navigate with a cache-buster:
browser.navigate({ url: "<permalink>?_nocache=<timestamp>" })
For the "Regenerate CSS files" triage, use `bricks/regenerate-css-files`, or use the WP admin path if the ability is disabled.

### Common verification tasks


#### Pixel-level match

Target: match a Figma frame within 5px.
1. Screenshot at Figma's viewport width.
2. Compare element dimensions (heading size, button width, card padding).
3. Fix via global-var edits where possible.

### Common verification tasks


#### Regression check

Target: "did anything break after my last set of edits?"
1. Take "before" screenshot (ideally stored from a prior session).
4. Narrate deltas. Anything unexpected means regression.
If no "before" exists, skip this: you can't prove no-regression without a baseline.

### Common verification tasks


#### Responsive check

Target: "does this page look right at mobile/tablet/desktop?"
1. Screenshot at each of 3 widths.
2. For each, note: does content reflow gracefully? Are touch targets big enough (min 44px)? Is copy readable?
3. Fix per-breakpoint via Bricks' breakpoint panel.

### Common verification tasks


#### Interactive check

Target: "does the mobile nav open when the hamburger is clicked?"
browser.click({ selector: ".hamburger-btn" })
Confirm the nav is now open. Same pattern for popups, accordions, tabs, form submissions.

### Common verification tasks


#### Performance check

Target: "is this page fast?"
Browser tools vary in Lighthouse support. Fallback: use the browser's console and network inspection operations to see what's loading.
- Total bytes transferred (< 1MB is aspirational).
- Font files (should be 1-2, not 10).
- Unused CSS / JS from plugins.
- Third-party scripts (analytics, pixel, chat widget).

### Silent-failure debug order

a. Permalink wrong: try manually in a browser.
b. Post is draft and preview URL expired: republish or use `?preview=true&p=<id>`.
c. SSL error: check site URL in WP settings.
2. **Screenshot shows builder UI instead of rendered page?**
a. You're screenshotting the `/wp-admin/post.php?action=bricks` URL. Use the permalink, not the edit URL.
3. **CSS changes don't appear?**
a. Stale Bricks CSS file. Re-save the page in builder (forces regeneration), or toggle CSS loading mode.
b. Browser cache. Hard-reload.
c. Site-wide cache plugin. Flush.
4. **JS-driven content empty?**
a. Lazy-load plugin swapping images: not a Bricks issue.
b. Query loop with `orderby: rand` returning different items per request: known behavior, seed TTL reset.
5. **Different output than builder preview?**
a. Builder is logged-in admin context. Frontend is visitor context. Check condition-scoped templates, role-gated elements.
b. Builder uses fallback `$post`, frontend uses the real one.

### Never do

- Skip resolving the URL: passing an ID to a browser tool doesn't work. `create-post` gives you a permalink; `find-post` gives you builder metadata, not the public permalink.
- Claim "looks right" beyond what you actually checked. One relevant viewport is the default; resize across breakpoints only when the task is responsive.
- Loop-screenshot-loop forever. Cap visual iteration at 2 screenshot/fix rounds unless the user explicitly asked for design iteration or visual comparison — past the cap, stop and state what you can't fix (likely outside Bricks: plugin conflict, server config, DNS).
- Compare without a target. "Looks fine" isn't a verification: pair it with "matches Figma frame X" or "no regression from prior screenshot."
- Pass sensitive URLs (staging tokens, admin-preview links) to external browser tools without checking how that tool handles captured data.

### Related skills

- `figma-to-bricks`: upstream: generating what to verify against.
- `html-css-to-bricks`: upstream: conversion step whose output you're verifying.
- `site-reproduction`: parallel workflow: fetch + rebuild + verify against a target URL.
- `performance`: when verify finds "slow," profile from here.

## Academy reference

For browser verification and testing:
- **Browser Support**: https://academy.bricksbuilder.io/chapters/the-builder/#browser-support
- **Responsive Testing**: https://academy.bricksbuilder.io/chapters/the-builder/#responsive-testing
- **Developer Tools**: https://academy.bricksbuilder.io/chapters/the-builder/#dev-tools
