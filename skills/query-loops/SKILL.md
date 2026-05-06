---
name: query-loops
description: "Use when building or debugging any Bricks query loop: repeating an element across posts, terms, users, API data, or an array. Covers query types, pagination gotchas, custom-query hooks, and why loops silently render nothing."
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

# Bricks: query loops

A query loop makes one element render N times: once per post, term, user, API item, or array entry. It's the single most-used Bricks feature after the element tree itself, and the one with the most silent failure modes.

## Where loops can live

Only these elements can be toggled into a query loop (via the "Use Query Loop" setting in element settings):

- All layout elements: Container, Section, Block, Div
- Accordion and Accordion (Nestable)
- Slider and Slider (Nestable)
- Tabs (Nestable)

**If you don't see the toggle on an element, it can't be looped.** Wrap it in a Block or Div and loop that instead.

## Grid and flex layouts with query loops: critical architecture rule

The element with `hasLoop: true` **is the repeating item**. It renders once per loop item. It is a grid/flex **cell**, not the grid/flex **container**.

**Correct: grid container is the PARENT of the loop element:**

```
div  (grid container: display grid, repeat(3,1fr), no loop)
  `-- div  (hasLoop: true, query)   <- repeats once per post as a grid cell
        `-- card content
```

**Wrong: grid CSS on the loop element itself:**

```
div  (hasLoop: true, query, display grid, repeat(3,1fr))   <- WRONG
  `-- card content
```

Result of the wrong pattern: N separate 3-column grids each containing 1 card, all stacking vertically: a single tall column instead of a grid.

The fix is always the same: insert a non-looping parent element, move the grid/flex CSS to that parent, and keep the loop element as the cell template inside it. In the builder this means wrapping the loop element in a Div or Block before enabling "Use Query Loop." Via MCP it means the `set-page-elements` tree has a plain container parent before the element that carries `hasLoop: true`.

## Query types

| Type | Engine | When to use |
|------|--------|-------------|
| Posts | `WP_Query` | Posts, pages, CPTs. Default. |
| Terms | `WP_Term_Query` | Taxonomy archives, category grids. |
| Users | `WP_User_Query` | Team pages, author directories. |
| API | Bricks Query API | Remote JSON/data sources configured in the Query API controls. Bricks 2.1+. |
| Array | Plain PHP array | API responses, ACF Repeaters, custom arrays. Bricks 2.2+. |

Current source defines these object types in `includes/setup.php:1120-1126`. Media is not a separate `objectType`: it is a Posts loop where `post_type` is `attachment`. Custom Query is also not an `objectType`; it is the PHP editor mode available for post, term, and user queries.

### Posts: the common gotchas

- **Always add `ID` as the secondary order-by** when using any non-ID primary (date, title, random). Without it, paginated pages can duplicate posts across pages. This is a documented warning, not a quirk.
- **"Disable Query Merge"** must be ON for header/footer/sidebar loops. Bricks auto-merges the archive/search query into the "main" loop on those pages: leaving it off turns every loop on the page into the same results.
- **Only one archive main query per page.** Bricks scans elements in builder order and uses the first loop marked `is_archive_main_query` to prepare the archive main query (`includes/database.php:222-287`). Do not mark a second loop as the archive main query: pagination and Query Filters will target the main query id Bricks selected, not a competing loop.
- **Random ordering + pagination**: set `Random seed TTL` to a non-zero value. Otherwise the random seed resets between pages and the same post appears on page 1 and page 2. Set to `0` to disable.
- **Include / Exclude with dynamic data** (v1.12+): the post type on the loop must match the field's referenced post type. Gallery fields -> Media. Relationship fields -> matching CPT. Mismatch returns no results, silently.

### Media attachments: the `{featured_image}` trap

In an attachment loop, use `{post_id}` for the image source and `{post_title}` for alt/title. **`{featured_image}` does not work for attachment items**: attachments don't have featured images of their own. Use a Posts query with `post_type` set to `attachment`.

### Array: nesting to access inner arrays

```
{query_array:raw}                 -> current array entry (root)
{query_array:raw @key:'cars'}     -> specific key's value
```

To loop through a nested array inside the parent loop: nest another Array Loop element, set its array source to `{query_array:raw @key:'cars'}`. Only Array loops nest cleanly today.

### Custom Query (PHP)

- Requires the Bricks code-execution capability: gated by `Capabilities::current_user_can_execute_code()`. The underlying WP capability is `bricks_execute_code`.
- For post, term, and user object types, the editor expects a PHP array of query args. Non-array output is ignored after validation and Bricks continues with the remaining query vars, which may produce an empty loop depending on context.
- Don't use this for things the normal Posts loop or query hooks can do. It is harder to audit and debug.

## The loop-marker trap (critical)

Bricks marks query-loop output so frontend AJAX pagination, Load More, Infinite Scroll, and Query Filters can swap the right DOM region.

Current source flow:

- Server render adds a `data-brx-loop-start` marker to the loop wrapper (`includes/query.php`).
- Frontend JS converts that marker to a comment shaped like `<!--brx-loop-start-{queryId}-->` (`src/assets/js/frontend.js`).

If cached or optimized HTML removes Bricks loop markers, AJAX swaps silently fail. Check both page source for `data-brx-loop-start` and the live DOM for `<!--brx-loop-start-...-->`. Configure optimization plugins to preserve Bricks loop markers.

## Loop-context dynamic tags

Inside a loop, the current post/term/user context rebinds so these tags resolve against the loop iteration, not the outer page:

**Posts loop:** `{post_id}`, `{post_title}`, `{post_excerpt}`, `{post_content}`, `{post_date}`, `{post_modified}`, `{featured_image}`, taxonomy-specific `{post_terms_{taxonomy}}`, and custom fields as `{cf_meta_key}` after lookup.

**Terms loop:** `{term_id}`, `{term_name}`, `{term_url}`, `{term_description}`, `{term_meta:key}`.

**Users loop:** `{wp_user_display_name}`, `{wp_user_email}`, `{wp_user_id}`, `{wp_user_meta:key}`

**API loop (v2.1+):** `{query_api @key:'title|rendered'}` for nested API data.

**Array loop (v2.2+):** `{query_array:raw}`, `{query_array:raw @key:'name'}`

Outside a loop these tags fall back to the current main query: which on an archive is the archive query, on a single post is that post, on a homepage is usually nothing. Always verify the context you expect.

## Custom queries via PHP hooks

If the UI can't express what you need, hook into the query pipeline. Don't reach for "Custom Query (PHP)" first: hooks are safer and don't require the code-execution capability on the user.

| Hook | Type | What it does |
|------|------|--------------|
| `bricks/posts/query_vars` | filter | Mutate `WP_Query` args for any Posts loop |
| `bricks/terms/query_vars` | filter | Same for `WP_Term_Query` |
| `bricks/users/query_vars` | filter | Same for `WP_User_Query` |
| `bricks/query/run` | filter | Short-circuit the query: return a custom array of items |
| `bricks/query/result` | filter | Mutate the result array post-fetch, pre-render |
| `bricks/query/result_count` | filter | Override the count (pagination uses this) |
| `bricks/query/result_max_num_pages` | filter | Override max pages for pagination |
| `bricks/query/loop_object` | filter | Swap the object the current iteration binds to |
| `bricks/query/loop_object_id` | filter | Swap just the id |
| `bricks/query/loop_object_type` | filter | Swap the type (post / term / user) |
| `bricks/query/no_results_content` | filter | Custom "no results" output |
| `bricks/query/before_loop` | action | Fires once before the loop renders |
| `bricks/query/after_loop` | action | Fires once after |
| `bricks/query/init_loop_index` | filter | Override starting index |
| `bricks/posts/merge_query` | filter | Control auto-merge behavior for Posts loops |

Most query lifecycle hooks pass the loop's `$query` object. `$query->element_id` scopes those callbacks to one loop. The `posts/terms/users/query_vars` filters pass query vars plus settings, element id, and element name, so check the signature before writing the callback.

## Debugging: "my loop shows nothing"

Walk this list in order: 80% of the time it's one of the first three:

1. **Did you click Save on the page?** Loop configs live in the element settings of the page, not in global state.
2. **Does the query return results outside Bricks?** Run the equivalent `WP_Query` in a plain template or via `wp shell`. If zero, the query is wrong, not Bricks.
3. **Is "Disable Query Merge" needed?** (Header/footer/sidebar loops almost always.)
4. **Does the loop element itself have visible content?** A Block with no children, set to "Use Query Loop", renders N invisible blocks.
5. **Are the loop's inner dynamic tags actually loop-aware?** `{post_title}` inside a Users loop resolves to the outer post, not the current user. You want `{wp_user_display_name}`.
6. **Is there a performance plugin or cache layer stripping loop markers?** See the loop-marker trap above.
7. **Is the include/exclude field post-type aligned?** (See Posts gotchas.)
8. **Is there a `bricks/query/run` filter hooked somewhere returning `null` or `[]`?** Check theme code and any custom plugins.

If the loop *does* render but infinite-loops (every item is the same), you set `{query_array:raw}` where you needed the parent loop's `{post_title}`: the context binding is still pointing at the parent.

## Never do

- **Don't put grid/flex container CSS on the loop element.** It repeats with the loop: every iteration gets its own layout context, so you end up with N separate grids each holding 1 item. The grid container must be the loop element's non-looping parent.
- **Don't loop a Template element inside another loop**: templates can't inherit loop context without explicit passing. Use a Block wrapping the content instead.
- **Don't use Custom Query (PHP) when a hook would work.** The PHP editor is a sharp tool and leaves custom PHP scattered across element settings, which makes audits painful.
- **Don't nest Posts loops to "get related posts"** when the parent loop is on an archive: each iteration spawns a new `WP_Query`, which scales quadratically. Use a single Posts loop with a hooked `bricks/posts/query_vars` that references the current post's relationships.
