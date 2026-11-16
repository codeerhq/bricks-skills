---
name: bricks-drafts
description: "Save Bricks changes as a private draft or site version, offer design alternatives, compare versions, share review links, or publish or undo a draft. Bricks 2.5+, experimental."
---

# Bricks: drafts, site versions and alternatives

Drafts let an agent change a Bricks site without changing what visitors see. They are experimental in Bricks 2.5 and off by default.

Use this skill when the user asks to work "as a draft", "don't publish yet", "give me a few options", "compare directions", "send the client a preview link", or to publish or undo draft work. For an ordinary live edit, do not use drafts.

## Availability

- Drafts exist only when **Bricks > Settings > Builder > Drafts & site versions > Enable drafts** (`enableDrafts`) is on. Turning it on is a site-wide experimental choice: ask the user first; never enable it as a side effect of another task.
- While drafts are off, the draft abilities are not registered and editing abilities have no `draft` parameter. Missing draft abilities usually mean the setting is off or the site runs Bricks 2.4 or older.
- `bricks/publish-draft` is off by default under **Bricks > AI**. An admin must enable it before an agent can publish.
- Review link abilities (`share-version`, `list-review-links`, `revoke-review-link`) also need **Enable review links** (`enableReviewLinks`).
- Access uses Builder permissions: `access_page_drafts`, `access_site_versions` (also needs the WordPress `edit_others_posts` capability), `publish_drafts`, `share_review_links`. `bricks/list-drafts` returns what the current user can do in `can`. If `can` lacks a permission, ask someone who has it.

**Never fall back to a live write.** If the user asked for a draft and the ability you need has no `draft` parameter or the draft abilities are missing, say so and stop. Do not write live and do not edit WordPress metadata directly.

## Edit inside a draft

Pass `draft` to editing abilities:

- `draft: true` uses the draft of the page being edited and creates it if needed. Site-wide changes without a page go to your "Agent draft".
- `draft: "<id>"` targets a specific draft or site version from `list-drafts`.

The parameter is offered only by draftable abilities, such as element and page-settings writes, workspace and agent-file commits, HTML/CSS imports, template settings and conditions, interactions, conditions, form and popup settings, and global class, variable, palette, theme style, component, query, breakpoint, pseudo-class, Style Manager and custom-font writes. Check the live schema for the exact ability.

Pass `draft` to reads too (`get-page-elements`, `get-design-context`, `list-global-classes`, and so on). A read without it shows live data, not the draft.

The response adds `draft.previewUrl` and `draft.builderUrl`. Share those links; do not build your own.

With `draft`, writes accept an optional `idempotencyKey`. Reuse the same key and the same input when retrying an uncertain response.

### What stays in the draft

A draft holds what visitors would see change: page content and settings, and edits to shared classes, variables, colors or components that published pages use.

New shared items, and items proven unused by live content, go live right away. They are listed in `draft.sharedLive`. Tell the user when this happens. If a later write fails, the error data can still list items in `sharedLive` that already went live.

Shared classes and components keep their identity when published, so publishing changes them everywhere they are used. Create a local copy only when the user wants a page-specific change.

## Site versions

For a change across several pages and global styles, such as a redesign or one of several directions, use a named site version:

```
bricks/create-version { "name": "Autumn redesign" }
bricks/create-version { "name": "Option B", "from": "<draft or version id>" }
```

It starts from the live site unless `from` names a draft or version to copy. Edit it with `draft: "<version id>"`.

## Offer alternatives

When the user wants options to choose from, call `bricks/create-alternatives` once with independent groups:

```json
{
  "postId": 42,
  "groups": [
    {
      "label": "Headline",
      "choices": [
        { "label": "Bold", "edits": [{ "element": "h1abcd", "settings": { "text": "Built to last" } }] },
        { "label": "Calm", "edits": [{ "element": "h1abcd", "settings": { "text": "Quietly better" } }] }
      ]
    },
    {
      "label": "Accent",
      "choices": [
        { "label": "Navy", "edits": [{ "variable": "accent", "value": "#1b2a4a" }] },
        { "label": "Coral", "edits": [{ "variable": "accent", "value": "#ff6f59" }] }
      ]
    }
  ]
}
```

- Each edit is `{ element, settings }`, `{ variable, value }` or `{ class, settings }`. Read element IDs and setting shapes first.
- Groups are independent decisions. The user picks one choice per group and can mix them.
- Alternatives live in the page's draft unless `draft` names another. `replace: true` replaces existing alternatives instead of adding to them.
- Share the returned `exploreUrl` (switch options) and `compareUrl` (side by side). Each choice also has a `previewUrl`. Switching and comparing needs no further calls.
- Nothing goes live. When the user picks, call `bricks/apply-alternatives { draft, picks: { "Headline": "Bold", "Accent": "Navy" } }`, then check `sharedLive` and `keptInDraft` in the result.

`bricks/compare { views: [...] }` returns a link that shows up to four views side by side. Each view is `{ draft: "<id>" | "live", picks? }`.

## Review, publish and undo

1. Call `bricks/review-draft { draft }` and show the user what publishing would change, item by item, including conflicts with newer live edits.
2. Publish only after the user approves: `bricks/publish-draft { draft, revision }`, using the `revision` from that review. Publishing stops if the draft changed after the review.
3. For conflicts, ask the user which side to keep for each one, then pass `resolutions: { "<conflict key>": "draft" | "live" }`. Do not choose for them.
4. Re-read after publishing. Shared classes and components now render everywhere they are used.

To undo a publish, publish the returned `undoDraftId`, or an entry from `list-drafts` `undoPoints`. Add `reopenAsDraft: true` to keep the undone changes as a draft for further work.

`bricks/discard-draft { draft }` deletes a draft and its unpublished changes. It requires explicit user intent. Items the draft already shared stay unless `deleteUnusedCreated: true`, which removes only those no page or other draft uses.

## Review links

Create a review link only when the user asks to share with someone outside the site:

- `bricks/share-version { draft, days? }` creates a view-only link for people without a login. It expires after 1-30 days (default 7). The URL is shown only once, so give it to the user immediately.
- `bricks/list-review-links { draft }` shows each link's ID, whether it still works and when it expires. It does not show URLs.
- `bricks/revoke-review-link` stops one link (`linkId`) or all links of a draft (`draft` with `all: true`).

Reviewers can view only. They cannot comment, apply alternatives or publish.

## Global data revisions in drafts

`bricks/restore-global-revision` accepts `draft`. When live pages use the item, the restore is held in the draft and returns `newEntryId: null` until publish. An item nothing uses goes live right away. See **bricks-design-systems** for global data revisions outside drafts.

## Sources

`includes/abilities/drafts.php`, `includes/abilities/explore.php`, `includes/drafts.php` and `includes/review-links.php` in Bricks 2.5. Live ability schemas take precedence over examples here.
