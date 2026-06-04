---
name: bricks-performance
description: "Use when diagnosing or fixing Bricks site performance: \"why is my site slow?\", \"CSS is huge\", \"first-load is bad\", \"LCP is 4 seconds\". Covers the `cssLoading` file-vs-inline setting, the loop-marker preservation trap, random-seed TTL, query cache, and the real-world fixes that move numbers."
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

# Bricks: performance

Bricks is reasonably fast out of the box. When sites get slow, it's almost always one of a handful of causes: CSS loading mode, stripped Bricks loop markers breaking AJAX, missing query cache, image-handling defaults, or too many interactions. Use this diagnostic order for real-world performance issues.

## CSS loading: file vs inline (the biggest lever)

Setting: `Bricks > Settings > Performance > CSS loading method`. Stored as `cssLoading` in the Bricks settings registry (`includes/abilities/settings.php`) and used by the asset loader (`includes/assets.php`).

| Mode | Value | Tradeoff |
|---|---|---|
| Inline (default) | `''` (empty string) | One less HTTP request. CSS ships in `<style>` blocks inside `<head>`. Repeated across all pages: not cached by browser. |
| External file | `'file'` | Separate `.css` files per template / global style. Browser-cacheable. Tiny HTTP request but cold-load pays for it. |

**Which to pick:**
- Small, high-reload sites (landing pages, blogs) -> `inline`. Zero round-trips matters more than byte duplication.
- Larger sites, multi-page journeys -> `file`. Cache wins by page 2.
- E-commerce -> `file`. Cart pages differ from product pages; browser cache across pages is a big win.

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

- Set to **60** (default): randomized order stays consistent for 60 minutes per visitor. Works for "random featured products" on a homepage.
- Set to **0**: pagination breaks for random-order loops. Only for loops without pagination.
- Long TTL (hours/days): reduces server work but keeps the "random" stable for longer: can feel less random to repeat visitors.

**Storage:** Bricks sets a transient keyed by `bricks_query_loop_random_seed_{element_id}` (`includes/query.php:2584`). The seed is shared by queries for the same element until the transient expires. Bricks also deletes it when the random-seed setting changes.

## Query caching

Setting: `Bricks > Settings > Performance > Cache query loops` (checkbox `cacheQueryLoops` at `admin/admin-screen-settings.php:1962`).

Uses WordPress object cache through `wp_cache_get()` / `wp_cache_set()` (`includes/query.php`). A persistent object cache such as Redis or Memcached makes it useful across requests. Without one, the cache is request-local and the benefit is much smaller.

Caches query results for one minute, keyed by element id, query vars, parent loop object id, and any language-specific cache-key filters. Huge win on:
- Archive pages with expensive meta queries.
- "Related posts" loops that run on every single.
- Any loop referencing ACF Relationship fields.

**Invalidation:** current source uses a short object-cache TTL (`MINUTE_IN_SECONDS`) rather than a broad explicit invalidation graph for every content change. If a persistent object cache serves stale loop results, clear the object cache or adjust the query cache key through `bricks/query/cache_key` for the context you need.

## Assets: webfonts, images

### Webfonts

Bricks enqueues Google Fonts automatically when a theme style references them. **This is an external request per font file, blocking first paint.**

Fixes:
1. Self-host Google Fonts. Paste the `.woff2` into the Bricks custom-fonts panel; reference the custom font in theme styles.
2. Filter `bricks/assets/load_webfonts` to false + enqueue your own self-hosted fonts via child theme.
3. Preload the primary font in `<head>` with `<link rel="preload" as="font" crossorigin>`.

### Images

Bricks doesn't lazy-load by default: WP does, since 5.5. Verify `loading="lazy"` is present on images below the fold.

For LCP:
- Hero image should **not** have `loading="lazy"`. Add `priority` or use `<link rel="preload">`.
- Use responsive srcset: Bricks' image element emits it automatically. Confirm `srcset` on rendered HTML.
- Serve WebP/AVIF via a plugin or server-side (Cloudflare Polish, ShortPixel). Bricks outputs whatever URL the media library has.

## Interactions cost (recap from `bricks-interactions` skill)

Each interaction:
- Adds event listener(s) at DOM-ready.
- Ships JSON inline in `data-interactions`.
- Runs per-fire: target lookup, condition eval, action.

100-card grid x 5 interactions = 500 listeners + 500 JSON payloads in HTML. Big pages inflate fast.

**Fixes in order:**
1. Put reusable interactions on the global class the card uses, not on each card instance.
2. For true delegated trigger matching, use a small enqueued JS handler. Bricks interaction target selectors point actions at another element; they are not a selector-based delegated trigger model.
3. For CSS-only behaviors, drop the interaction: use a pseudo-class.

## Builder JavaScript: `frontend.js`

The Bricks frontend source is `src/assets/js/frontend.js`; the compiled runtime is enqueued as `bricks-scripts` from `assets/js/bricks.min.js` (`includes/setup.php:445-446`). It handles core frontend behavior such as interactions, popups, sliders, accordions, and filter helpers, and it is loaded as the main Bricks frontend script.

Optimization:
- **Defer**: by default, Bricks loads with `defer`. If you see it as blocking, a plugin is overriding. Fix the plugin.
- **Compression**: ensure gzip / Brotli enabled on the server. Bricks doesn't double-compress.
- **Version query**: `?ver=X.Y.Z` parameter means CDNs cache per-version. No invalidation needed on update.

## Database: revision bloat

Bricks creates a revision of the `_bricks_page_content_2` meta on every save. On a busy site, this blob can double every week.

Fixes:
- `wp_revisions_to_keep` in `wp-config.php`: limit to 10-30 per post.
- Periodic cleanup: `WP Admin > Tools > Optimize > Old revisions` (with a plugin like WP-Optimize).
- Bricks revision API (see `revisions.php` + MCP `list-revisions` / `prune-revisions` abilities if present).

## Diagnostics: what to measure

Before optimizing, measure:

1. **Chrome DevTools > Lighthouse**: reports LCP, CLS, TBT, TTI.
2. **Chrome DevTools > Performance**: flame chart. Find the big JS blocks.
3. **Chrome DevTools > Network**: waterfall. First-paint-blocking requests.
4. **`wp-content/debug.log`** with `WP_DEBUG_LOG=true`: `error_log()`s from Bricks catches.
5. **Query Monitor plugin**: slowest queries per page.
6. **`bricks_assets` transient in DB**: Bricks' asset cache state.

Then optimize the biggest lever. Don't micro-optimize per pixel.

## The 5-minute triage

Site is slow: walk this in order, fix what's broken:

1. **CSS mode**: inline? Switch to `file` for 3+ page journeys.
2. **Loop markers preserved?** Check source and live DOM for Bricks loop markers. If missing, find the stripping plugin or cache layer.
3. **Cached queries?** Object cache active? Bricks cache setting on?
4. **LCP image**: not lazy, preloaded, reasonable size?
5. **JS count**: more than 5-10 interactions per card? Move shared behavior to a global class, or use one delegated JS handler for the repeated grid behavior.
6. **Third-party scripts**: any Google Analytics / Facebook Pixel / heatmap loading synchronously in `<head>`? Defer them.
7. **CDN?** Cloudflare / BunnyCDN in front of the origin? If not, set up.

If after this you're still slow, the bottleneck is app-specific: profile with DevTools Performance.

## Never do

- Run on shared hosting and blame Bricks. Shared PHP is slow; Bricks inherits the floor.
- Enable WP Rocket "Remove unused CSS" without testing: Bricks emits conditional CSS per-element, and the scan misses much of it. Sites break; fix means custom exclusions.
- Strip Bricks loop markers globally. Always preserve `brx-loop` markers.
- Cache the entire site page-by-page without excluding cart, checkout, `wp-admin`, preview URLs. Stale cart = lost sale.
- Skip object cache setup on a Woo or forum-ish site. It's the difference between 200ms and 2000ms per request.
- Optimize without measuring. "It feels slow" is not a metric.

## Related skills

- `custom-code`: CSS cascade order, where custom CSS lives.
- `interactions`: interaction cost details.
- `query-loops`: loop-specific performance (include/exclude, include-query).
- `site-audit`: full-site scan includes performance signals.
