---
name: bricks-browser-verify
description: "Use when the user wants to visually confirm a Bricks page renders correctly, regressions are absent, or a build matches a target design: \"verify this page looks right\", \"screenshot the homepage\", \"check the result in a browser\". Covers resolving the frontend URL from post abilities, using the available browser tool, screenshot comparison, and the iterate-via-update-element loop."
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

# Bricks: browser verification loop

No new Bricks abilities here. This workflow composes existing abilities. It sequences the Bricks post abilities (`find-post`, `create-post`, `get-page-elements`, `update-element`) with whatever browser tool is available in the current client.

If no browser tool is available, stop at "resolve URL" and hand the URL back to the user.

## Why verify

Bricks' builder preview **isn't always the frontend**. Common drift sources:
- Custom CSS with context scoping (`body.logged-in`) differs between builder (always logged-in) and frontend visitor (not).
- Cache plugins serving stale CSS to front-end visitors.
- Query loops behaving differently per context (admin query vs public query).
- Dynamic-data values resolving to different values (admin sees drafts, frontend doesn't).
- Lazy-loaded images below the fold not firing in builder preview's viewport.
- Interactions / JS not running in builder-preview context.

The builder is a development surface. Frontend is truth. Always verify.

## Step 1: Resolve the frontend URL

`create-post` returns a `permalink`. `find-post` does not.

```
find-post({ postType: "page", query: "Home" })
// -> returns { results: [{ id, title, slug, path, postType, status, builderUrl, ... }], total }

create-post({ postType: "page", title: "Pricing" })
// -> returns { postId, title, slug, postType, status, builderUrl, permalink, ... }
```

Use `create-post`'s `permalink` directly. For existing posts found through `find-post`, use the returned `builderUrl` only when you intend to inspect the builder route. If you need the public frontend URL, derive it from the site's permalink structure or another WordPress source; current `find-post` output does not include `permalink`.

If the post doesn't exist:
```
create-post({ postType: "page", title: "Test", status: "draft" })
```

## Step 2: Open in the browser

Use the browser tool available in the current client. Tool names vary, but you need these operations:
- Navigate to the public permalink.
- Capture a screenshot.
- Resize the viewport for responsive checks.
- Click or evaluate JavaScript when testing interactions.

Generic operation shape:

```
browser.navigate({ url: "<permalink>" })
browser.screenshot({})
```

### Dimensions

Default viewport is often 1280x720. For responsive checks:

```
browser.resize({ width: 375, height: 667 })   // mobile
browser.screenshot({})

browser.resize({ width: 768, height: 1024 })  // tablet
browser.screenshot({})

browser.resize({ width: 1440, height: 900 })  // desktop
browser.screenshot({})
```

Match Bricks' default breakpoints: desktop base `1279`, tablet portrait `991`, mobile landscape `767`, and mobile portrait `478` (`includes/breakpoints.php`).

## Step 3: Compare

Review the screenshot as image input. Describe the expected output:
- From a target design (Figma frame, mock, screenshot-before)
- From a specification ("the hero should have a white background, 48px heading, centered")
- From a prior screenshot ("did anything break since the last save?")

Articulate mismatches concretely:
> "The pricing card's border-radius looks ~4px but the design shows 12px."
> "The CTA button is left-aligned; should be center."
> "The hero image fills width but the design shows max-width 1200px with side padding."

Vague observations ("looks off") don't lead to actionable fixes.

## Step 4: Identify the element

For each mismatch, find the element in the Bricks tree:

```
get-page-elements({ postId: 42 })
// -> returns the element tree with IDs, types, settings
```

Search the tree for the element matching the mismatch. Common signals:
- An Image element with `_root` settings mentioning the hero URL.
- A Heading element with the target text.
- A Container element with the class the mismatch relates to.

## Step 5: Fix

```
update-element({
  postId: 42,
  elementId: "hero-xyz",
  settings: {
    _padding: { top: "64px", bottom: "64px", left: "24px", right: "24px" }
  }
})
```

For style changes via global variables / theme styles, don't edit the element: edit the variable:

```
set-global-variables({
  variables: [ { name: "radius-md", value: "12px" } ]  // was 8px
})
```

One global change > many element edits.

## Step 6: Re-screenshot

```
browser.screenshot({})
```

Verify the change landed. Iterate on remaining mismatches.

**When re-screenshotting:**
- Hard-reload if CSS changes don't appear. Cache layer may serve stale CSS.
- Wait ~500ms if animations are involved (hero image fade-in).
- For AJAX-loaded content (query filters, Load More), trigger the interaction before screenshot.

### Cache-busting

Bricks caches element CSS per-page in `wp-content/uploads/bricks/css/`. Hard reload often solves stale styles:

```
browser.evaluate({ code: "location.reload(true)" })

// or navigate with a cache-buster:
browser.navigate({ url: "<permalink>?_nocache=<timestamp>" })
```

For the "Regenerate CSS files" triage, use `bricks/regenerate-css-files`, or use the WP admin path if the ability is disabled.

## Common verification tasks

### Pixel-level match

Target: match a Figma frame within 5px.

1. Screenshot at Figma's viewport width.
2. Compare element dimensions (heading size, button width, card padding).
3. Fix via global-var edits where possible.
4. Re-screenshot.

### Regression check

Target: "did anything break after my last set of edits?"

1. Take "before" screenshot (ideally stored from a prior session).
2. Make the edits.
3. Take "after" screenshot.
4. Narrate deltas. Anything unexpected means regression.

If no "before" exists, skip this: you can't prove no-regression without a baseline.

### Responsive check

Target: "does this page look right at mobile/tablet/desktop?"

1. Screenshot at each of 3 widths.
2. For each, note: does content reflow gracefully? Are touch targets big enough (min 44px)? Is copy readable?
3. Fix per-breakpoint via Bricks' breakpoint panel.

### Interactive check

Target: "does the mobile nav open when the hamburger is clicked?"

```
browser.click({ selector: ".hamburger-btn" })
browser.screenshot({})
```

Confirm the nav is now open. Same pattern for popups, accordions, tabs, form submissions.

### Performance check

Target: "is this page fast?"

Browser tools vary in Lighthouse support. Fallback: use the browser's console and network inspection operations to see what's loading.

```
browser.network({})
// -> array of requests
```

Look for:
- Total bytes transferred (< 1MB is aspirational).
- Font files (should be 1-2, not 10).
- Unused CSS / JS from plugins.
- Third-party scripts (analytics, pixel, chat widget).

## Silent-failure debug order

1. **Screenshot blank / white?**
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

## Never do

- Skip resolving the URL: passing an ID to a browser tool doesn't work. `create-post` gives you a permalink; `find-post` gives you builder metadata, not the public permalink.
- Trust a single screenshot. Viewport-resize for mobile/tablet/desktop before claiming "looks right."
- Loop-screenshot-loop forever. If 3 iterations don't converge, stop and state what you can't fix (likely outside Bricks: plugin conflict, server config, DNS).
- Compare without a target. "Looks fine" isn't a verification: pair it with "matches Figma frame X" or "no regression from prior screenshot."
- Pass sensitive URLs (staging tokens, admin-preview links) to external browser tools without checking how that tool handles captured data.

## Related skills

- `figma-to-bricks`: upstream: generating what to verify against.
- `html-css-to-bricks`: upstream: conversion step whose output you're verifying.
- `site-reproduction`: parallel workflow: fetch + rebuild + verify against a target URL.
- `performance`: when verify finds "slow," profile from here.
