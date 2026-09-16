---
name: bricks-browser-verify
description: "Inspect a Bricks page in a browser, compare it with a design or baseline, or verify a completed change. Inspection requests remain read-only."
---

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
