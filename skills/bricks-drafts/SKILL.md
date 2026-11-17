---
name: bricks-drafts
description: "Keep Bricks changes in a private draft or site version, offer alternatives to compare, share a review link, or publish or undo a draft publish (Bricks 2.5+). Skip for ordinary live edits."
---

# Bricks: drafts, site versions and alternatives

Drafts are experimental in Bricks 2.5 and off by default. The draft abilities describe their own inputs; this skill covers availability, ordering and the traps.

## Availability

- Draft abilities and every `draft` parameter exist only while **Bricks > Settings > Builder > Drafts & site versions > Enable drafts** (`enableDrafts`) is on. Turning it on is a site-wide experimental choice: ask first; never enable it as a side effect.
- Review link abilities also need **Enable review links**. `publish-draft` is disabled under **Bricks > AI** until an admin enables it.
- When an action is denied, check `can` in `list-drafts` and ask someone who has that permission.

**Never fall back to a live write.** If the user asked for a draft and the ability you need has no `draft` parameter, or draft abilities are missing, say so and stop. Do not write live and do not edit WordPress metadata directly.

## Working in a draft

- Only abilities whose schema shows `draft` are draftable. Similar writes are not and always go live, for example `create-post`, `create-template`, `create-custom-font`, `delete-custom-font`, `assign-component-category`, `update-filter-element`, Filter Manager writes and settings.
- Pass `draft` to reads too. A read without it returns live data, not the draft.
- New shared items, and items proven unused by live content, go live immediately (`draft.sharedLive`). Tell the user. A failed write can still report `sharedLive` items in its error data.
- Shared classes and components keep their identity when published, so publishing changes them everywhere. Make a local copy only when the user wants a page-specific change.
- Use the page's draft for one page. Use `create-version` for a redesign across several pages or global styles, or for competing directions.

## Alternatives

Put every option in one `create-alternatives` call, one group per independent decision. Share the returned links and stop; switching needs no further calls. When the user picks, call `apply-alternatives` once instead of re-editing elements. Nothing goes live until publish.

## Review, publish and undo

1. `review-draft`, then show the user each change and conflict.
2. After approval, `publish-draft` with the `revision` from that review.
3. For conflicts, ask which side to keep for each one; do not choose for the user.
4. Re-read after publishing: shared classes and components now render everywhere they are used.

To undo, publish the returned `undoDraftId` or an `undoPoints` entry. `discard-draft` and `share-version` need an explicit user request; give a review link URL to the user immediately, because it cannot be read back later.

Source: `includes/abilities/drafts.php`, `includes/abilities/explore.php` and `includes/drafts.php` in Bricks 2.5.
