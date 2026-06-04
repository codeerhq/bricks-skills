---
name: bricks-global-queries
description: "Use when creating or managing reusable queries that multiple loop elements can share. Covers the `bricks_global_queries` option, categories, and how a query-list control on an element references a global query by ID."
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

# Bricks: global queries (via MCP)

A **global query** is a named, reusable query definition stored at the site level. Multiple loop/filter elements can reference the same global query by ID instead of duplicating args. Useful when the query is complex (ACF meta filters, taxonomy unions, custom SQL) and reused across templates.

Storage: `bricks_global_queries` (query rows with `id`, `name`, `category`, and `settings`) + `bricks_global_queries_categories` (category rows with `id` and `name` for the builder UI grouping).

## Abilities

- **`bricks/list-global-queries`**: summary rows plus category list.
- **`bricks/get-global-query`**: `{ queryId }`. Full query object.
- **`bricks/create-global-query`**: `{ label, category?, query }`. Returns `{ query }`. The API accepts `label` and `query`, then stores them in Bricks as `name` and `settings`. The optional `category` is a category ID, not a label.
- **`bricks/update-global-query`**: `{ queryId, label?, category?, query? }`. If `query` is provided, it replaces the whole query settings object.
- **`bricks/delete-global-query`**: `{ queryId }`. **Does not** unlink referencing elements: those keep the dangling id and fall back to their local query or render empty.
- **`bricks/create-global-query-category`**: `{ name }`. Returns `{ category }`.
- **`bricks/delete-global-query-category`**: `{ categoryId }`. Queries in that category are kept and become uncategorized.

## Query shape

Same shape as an inline query on a loop element:

```
{
  objectType: "post",      // "post" | "term" | "user"
  postType: ["post"],
  posts_per_page: 6,
  orderby: "date",
  order: "DESC",
  meta_query: [ ... ],
  tax_query: [ ... ]
}
```

`objectType` lives inside the `query` object. Common values are `post`, `term`, `user`, and `array`; Query API flows can also use `api`. For `post`, `term`, and `user`, it decides which Bricks query runner handles the args and which hooks fire (`bricks/posts/query_vars` vs `bricks/terms/query_vars` vs `bricks/users/query_vars`). The ability stores the query object as provided and does not narrow `objectType` itself (`includes/abilities/queries.php:123-142`).

## Binding to a loop

An element consuming a global query stores its id in `settings.query.id`:

```
query:
  id: "abc123"    // presence of this makes Bricks load the global query settings
  # inline args are ignored when id points to a valid global query
```

Write this through `bricks/update-element` on the target element; the query runner resolves the id at render time.

## Categories

Categories are pure UI: they group queries in the builder's dropdown. Write shape:

```
bricks/update-global-query
  queryId: abc123
  category: "cat_abc"
```

If you need a new category, call `bricks/create-global-query-category` first and pass the returned category ID into `create-global-query` or `update-global-query`. Passing a new label as `category` is wrong; the current schema expects a category ID.

## Tool availability

> **If a `bricks/*` ability is not available as a direct tool**: first check whether it is outside the fast path and call it through `mcp-adapter-execute-ability` with `ability_name: "bricks/<name>"`. If the dispatcher also rejects it, call `bricks-list-ability-status` to check whether a site admin disabled it under Bricks > Settings > AI.

## Typical flow: reusable "Featured Products" query

```
bricks/create-global-query-category { name: "Shop" }
  -> { category: { id: "cat_abc", name: "Shop" } }

bricks/create-global-query
  label: "Featured Products"
  category: "cat_abc"
  query:
    objectType: "post"
    postType: ["product"]
    posts_per_page: 8
    meta_query:
      - { key: "_featured", value: "yes" }
  -> { query: { id: "fp_8h2", name: "Featured Products", category: "cat_abc", settings: {...} } }

# Now bind it to an existing Products Loop element:
bricks/update-element
  postId: 42
  elementId: "loop-xyz"
  settings:
    query:
      id: "fp_8h2"
```

All future edits to "Featured Products" propagate to every element whose `settings.query.id` references that global query.

## Cross-context notes

- Global queries respect element-specific context. If the element lives in a single-post template, `get_the_ID()` inside query filters still resolves to the current post: the global query is the args, not the context.
- `bricks/posts/query_vars` filter fires for global queries exactly as it does for inline ones. Match on the calling element id, not the query id, if you need to branch per-consumer.

## Don't

- Don't delete a global query without first replacing or clearing references. Query-list controls on elements silently fall back when the id is missing, and that's hard to spot in a big site.
- Don't embed element-specific context in a global query (e.g., a hard-coded post id). Use dynamic tags (`{post_id}`) or the `bricks/posts/query_vars` hook so the query stays reusable.
- Do not treat the category field as load-bearing beyond UI organization. It is a category ID that points to a display label; it is not a permission or routing key.
