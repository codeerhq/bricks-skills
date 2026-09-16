---
name: bricks-performance
description: "Use when diagnosing or fixing Bricks site performance: \"why is my site slow?\", \"CSS is huge\", \"first-load is bad\", \"LCP is 4 seconds\". Covers the `cssLoading` file-vs-inline setting, the loop-marker preservation trap, random-seed TTL, query cache, and performance diagnostics."
---

# Bricks: performance

Measure the affected page before changing settings. Use request timing, rendered assets, query timings, and interaction profiles to identify the bottleneck, then compare the same page after the change.

## CSS loading

Setting: `Bricks > Settings > Performance > CSS loading method`. Stored as `cssLoading` in the Bricks settings registry (`includes/abilities/settings.php`) and used by the asset loader (`includes/assets.php`).

| Mode | Value | Tradeoff |
|---|---|---|
| Inline (default) | `''` (empty string) | One less HTTP request. CSS ships in `<style>` blocks inside `<head>`. Repeated across all pages: not cached by browser. |
| External file | `'file'` | Separate `.css` files per template / global style. Browser-cacheable. Tiny HTTP request but cold-load pays for it. |

Compare cold loads and repeat navigation with both modes on representative pages.

**File-mode regeneration:** files are written to `wp-content/uploads/bricks/css/` at save time. After a bulk update (site-wide CSS change, theme-style swap, class rename), regenerate all via `Bricks > Settings > Performance > Regenerate CSS files`. Without this, stale CSS serves until each template is manually saved.

**Filter:** `bricks/generate_css_file`: intercept per-file generation.

## The loop-marker preservation trap

Bricks query loops rely on loop markers for AJAX pagination, Load More, Infinite Scroll, and Query Filters.

Current source flow: server render adds `data-brx-loop-start`, then frontend JS converts it to a comment shaped like `<!--brx-loop-start-{queryId}-->`.

Optimization plugins and cache layers that remove Bricks markers can break AJAX swaps. Configure them to preserve Bricks `brx-loop` markers.

**Diagnostic:** inspect both page source and the live DOM on a page with a loop. Page source should contain `data-brx-loop-start`; the live DOM should contain a `brx-loop-start` comment. If either disappears after optimization, fix the plugin config and flush cache.

## Random seed TTL: pagination stability

Query loops with `orderby: rand` need a stable seed across paginated pages, or the same item shows on page 1 and page 3.

Setting: random seed TTL (in minutes). Stored as `randomSeedTtl` in query vars. Default: 60 min (`query.php:2566-2567`).

Keep a positive TTL for random-order loops with pagination. Choose the duration according to how often the order should change.

**Storage:** Bricks sets a transient keyed by `bricks_query_loop_random_seed_{element_id}` (`includes/query.php:2584`). The seed is shared by queries for the same element until the transient expires. Bricks also deletes it when the random-seed setting changes.

## Query caching

Setting: `Bricks > Settings > Performance > Cache query loops` (checkbox `cacheQueryLoops` at `admin/admin-screen-settings.php:1962`).

Uses WordPress object cache through `wp_cache_get()` / `wp_cache_set()` (`includes/query.php`). A persistent object cache such as Redis or Memcached makes it useful across requests. Without one, the cache is request-local and the benefit is much smaller.

Caches query results for one minute, keyed by element id, query vars, parent loop object id, and any language-specific cache-key filters.

**Invalidation:** current source uses a short object-cache TTL (`MINUTE_IN_SECONDS`) rather than a broad explicit invalidation graph for every content change. If a persistent object cache serves stale loop results, clear the object cache or adjust the query cache key through `bricks/query/cache_key` for the context you need.

## Images and fonts

Inspect the network waterfall and rendered markup:

- Check the LCP image’s loading behavior, dimensions, and responsive sources. Avoid lazy-loading the image responsible for initial visible content.
- Check font downloads and the styles that request them. Use `bricks-custom-fonts` when self-hosting fonts is part of the chosen fix.
- Confirm changes to image or font controls against the target site's element schema.

## Interactions

Interaction payload and event-handling work grow with the number of rendered elements. Profile repeated grids and expensive callbacks. Global-class interactions centralize authoring; each matching element still inherits the interaction rows.

Use CSS for simple visual states and consider delegated JavaScript handlers when profiling shows repeated event handling is costly. See `bricks-interactions` for storage and inheritance behavior.

## Frontend assets

The Bricks frontend source is `src/assets/js/frontend.js`; the compiled runtime is enqueued as `bricks-scripts` from `assets/js/bricks.min.js`. It handles interactions, popups, sliders, accordions, and filter helpers.

Inspect script loading and compression in the network response before changing optimization settings. After changing asset optimization, verify affected interactions, AJAX loops, and responsive styles.

## Verification

Compare the same page and interaction under matching cache and device conditions. Record the measured change and any remaining bottleneck. Preserve query-loop markers and exclude personalized cart and checkout responses from shared full-page caching.

## Related skills

- `custom-code`: CSS cascade order, where custom CSS lives.
- `interactions`: interaction cost details.
- `query-loops`: loop-specific performance (include/exclude, include-query).
- `site-audit`: full-site scan includes performance signals.
