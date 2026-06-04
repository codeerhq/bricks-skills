---
name: bricks-dynamic-data
description: "Use when working with Bricks dynamic data tags: \"what's the tag for ACF field X?\", \"why doesn't {post_title} show?\", \"how do modifiers work?\", \"format a date with dynamic data\". Covers the 8 providers, `:modifier` vs `|` syntax, scope binding in loops, and the `{echo:...}` cross-reference."
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

# Bricks: dynamic data

Dynamic data tags are Bricks' `{token}` syntax for binding content to live values. They resolve at render time, bind to the current post/term/user/loop context, and support modifier chains. Getting the syntax, scope, and modifier order wrong is how most "why doesn't this show?" tickets start.

## The 8 built-in providers

Files at `includes/integrations/dynamic-data/providers/provider-*.php`.

| Provider | File | Activation | Tag prefix / pattern |
|---|---|---|---|
| WordPress core | `provider-wp.php:12` | Always | `{post_*}`, `{wp_user_*}`, `{author_*}`, `{site_*}`, `{archive_*}`, `{term_*}`, `{featured_image}`, `{cf_meta_key}`, `{echo:...}` |
| ACF | `provider-acf.php:6` | ACF installed | `{acf_fieldname}` or the field group's returned tag (ACF field name, typically) |
| WooCommerce | `provider-woo.php:8` | Woo installed | `{woo_product_type}`, `{woo_product_price}`, `{woo_product_sale_price}`, `{woo_product_stock}`, etc. |
| CMB2 | `provider-cmb2.php:6` | CMB2 installed | `{cmb2_fieldname}` |
| JetEngine | `provider-jetengine.php:6` | JetEngine installed | `{je_fieldname}` |
| Pods | `provider-pods.php:6` | Pods installed | `{pods_fieldname}` |
| Toolset | `provider-toolset.php:6` | Toolset installed | `{ts_fieldname}` |
| MetaBox | `provider-metabox.php:6` | MetaBox installed | `{mb_fieldname}` |

**Don't trust a tag prefix blindly: and don't guess.** ACF field names are whatever the field was named in WP Admin; there is no reliable naming convention. `{acf_event_date}` and `{acf_start_date}` look equally plausible and only one will resolve. The only way to know is to look.

**Required lookup before writing any provider-specific tag:**
1. Call `bricks/list-dynamic-data-tags` with a `postId` from the target post type (for example, a product, event, project, or other custom post type). The response is scoped: ACF groups only appear for posts the group is assigned to.
2. Find your field's tag in the returned list. Copy the exact `tag` string.
3. Call `bricks/preview-dynamic-tag` with that tag and the same `postId`. If `unknownTags` is non-empty, the tag doesn't exist: go back to step 2.
4. Only then write it into an element.

Skipping this and guessing produces silently-broken templates: the tag renders as literal `{acf_start_date}` text in production with no error.

## Tag syntax

```
{tag_name}
{tag_name:modifier}
{tag_name:modifier:arg}
{tag_name:modifier1:arg:modifier2:arg}
```

The **colon (`:`)** separates tag name from modifier, modifier from argument, and chained modifiers. Confirmed at `includes/integrations/dynamic-data/providers/base.php:155-220`.

**Older `|` pipe syntax:** exists for one specific case: subkey access inside `array_value`:

```
{custom_field:array_value|first_name}
```

The pipe is **not a general-purpose modifier separator**: it's an `array_value` subkey accessor. Everything else is colon. `{post_title|format}` will not work.

## Common modifiers (from `base.php`)

| Modifier | Purpose | Example |
|---|---|---|
| date format string | Format a date/time value | `{post_date:M j, Y}` |
| `:format` | Keep HTML formatting for text values | `{post_excerpt:format}` |
| `:plain` | Strip HTML | `{post_excerpt:plain}` |
| `:raw` | No processing | `{cf_featured_image:raw}` |
| `:url` | Value interpreted as URL | `{cf_link_field:url}` |
| `:value` | Raw stored value (for fields with display/value pair) | `{acf_select:value}` |
| `:array_value\|key` (ACF/Meta) | Pull one key from an array return value | `{acf_link_field:array_value\|title}` |

Modifiers apply left-to-right. Positional date formats are stored as the parser's default `meta_key`, while known flags such as `:plain`, `:raw`, and `:array_value|key` set named filter keys (`includes/integrations/dynamic-data/providers/base.php:112-224`).

## Scope binding: the loop rule

Dynamic tags bind to the **current context**, which rebinds inside loops:

- Outside a loop: current main query's post (on a singular page), or nothing (on archives without an explicit post: use archive tags).
- Inside a Posts loop: the iteration's post.
- Inside a Terms loop: the iteration's term.
- Inside a Users loop: the iteration's user.

**Writing `{post_title}` inside a Users loop gives you the outer page's post title, not the user's display name.** Use the provider-specific tag: `{wp_user_display_name}`.

Full loop-tag cheatsheet in the `bricks-query-loops` skill.

## Meta-key access: `{cf_meta_key}`

Generic WP custom-field access uses the `cf_` prefix:

```
{cf_my_custom_key}              -> the meta value
{cf_my_custom_key:raw}          -> unprocessed
{cf_date_field:format:M j, Y}   -> formatted
```

`provider-wp.php` registers known `cf_` tags in the builder picker from site meta keys, but render also treats any tag beginning with `cf_` as post meta. The meta key is the part after `cf_`.

`bricks/dynamic_data/allowed_keys` does **not** gate post meta. It controls parser keys such as `@fallback`, `@sanitize`, `@key`, `@date`, `@from`, and `@to`.

## Echo tag: the escape hatch with a capability gate

`{echo:function_name(arg1, arg2)}` calls a PHP function at render time. Full threat model in the `bricks-custom-code` skill. Short version:

- Requires global code execution to be enabled.
- Requires the function be in the `bricks/code/echo_function_names` allow-list.
- In builder calls, the current user also needs `bricks_execute_code`; on normal frontend renders, the saved tag runs for visitors if global execution is enabled and the function is allow-listed.
- Without the required gate, returns empty string silently.
- Single quotes only for string args; no nested function calls; commas separate args.

**Never `return true` from the allow-list in production**: pre-1.9.7 RCE surface.

## Provider-specific surfaces

### ACF
- Direct access: `{acf_fieldname}` (uses ACF's field name, not label).
- Field groups have to be assigned to the current post's type for the tag to resolve.
- Relationship/post-object fields need the `:array_value|` pattern or a loop:
  - In a template displaying an ACF Relationship field: drop a Posts loop inside, set query to "Include -> dynamic data -> `{acf_my_rel}`".
  - Loop iterates related posts, `{post_title}` inside binds to the current related post.
- Repeater/Flexible Content: use Array-type loop with `{acf_my_repeater}` as source.

### WooCommerce
Woo tags resolve inside a product context: single product page, product-loop iteration, or an MCP preview call that passes a product `postId`. The dynamic-data parser itself does not support a `post_id` argument inside the tag.
- `{woo_product_price}` includes currency symbol.
- `{woo_product_price:value}` returns numeric only.
- Sale price `{woo_product_sale_price}`: empty if not on sale (use conditional display).

### JetEngine / Pods / Toolset / MetaBox / CMB2
Tags are registered lazily: they need the plugin's `init` hook to fire before they're available. In the builder: appear in the picker. On the frontend: depend on plugin load order. If a tag exists in builder picker but renders empty, check plugin-init priority.

## Parser keys

Dynamic data supports parser keys after the tag, such as `@fallback`, `@sanitize`, and `@key` for supported tags. It does **not** support arbitrary `@post_id`, `@term_id`, or `@user_id` context overrides in the current parser. To preview or render against a specific post through MCP, pass the `postId` parameter to `preview-dynamic-tag` or render inside the correct loop/context.

## Custom dynamic-data providers

For custom tags, use `bricks/dynamic_tags_list` to expose the tag in the picker and `bricks/dynamic_data/render_tag` to render it. The internal provider registry is filtered through `bricks/dynamic_data/register_providers`, while `bricks/dynamic_data/register_hook` only changes the WP hook Bricks uses for provider registration (`includes/init.php:158-169`, `includes/integrations/dynamic-data/providers.php:32-45`).

See the `bricks-custom-dynamic-data-providers` skill for the full pattern.

## The `[render_dynamic_data]` shortcode

Sometimes you need Bricks-style dynamic data outside Bricks templates: in a widget, or shortcode-placement area.

```
[render_dynamic_data content="Hello {user_display_name}, welcome to {site_title}."]
```

Resolves like it would inside a Bricks element. Handy for hybrid sites. Don't overuse: it's an escape hatch, not a primary surface.

## Verify-after-write: preview before committing

Before pasting a dynamic tag into a template setting via `update-element`, validate it with `preview-dynamic-tag`:

```
preview-dynamic-tag (tag: "{acf_my_field:plain}", postId: 42, context: "text")
-> { rendered, isEmpty, unknownTags: [] }
```

The response includes:
- `rendered`: actual rendered string (or array for `image`/`link` contexts).
- `isEmpty`: true when the rendered value is empty after trim.
- `unknownTags`: tag names that no provider recognized; **non-empty means the tag will render as literal text in production**. Treat any entry here as a hard failure: fix the tag name (use `list-dynamic-data-tags` to discover the right one) before writing.

Do this for every tag you author, not just suspected typos. Cheap, deterministic, catches the "rendered as literal" class of bug before it lands in a template.

## Silent-failure debug order

1. **Tag renders as literal `{post_title}` in output?**
   a. Provider not loaded yet (plugin init order). Check the tag in the builder picker: if absent there, provider not registered.
   b. Typo in tag name. Picker is authoritative: or call `list-dynamic-data-tags` and grep the result.
   c. Context doesn't support the tag (e.g., `{post_title}` on a term archive page without a loop).
   d. `preview-dynamic-tag` for the same tag/post returns the tag in `unknownTags`: confirms (a) or (b).

2. **Tag resolves empty on the frontend, fine in builder?**
   a. Builder preview uses a fallback post. Frontend may have no equivalent context.
   b. The field is not assigned to the current post/context, or the provider resolved an empty value.
   c. `{echo:...}` is not allow-listed, global code execution is off, or a builder preview user lacks `bricks_execute_code`.

3. **Date modifier doesn't format?**
   a. Modifier order wrong: `{post_date:format:M j, Y}` (format first), not `{post_date:M j, Y}`.
   b. The stored value isn't a date parseable by `strtotime`. Check raw value first.

4. **ACF Relationship field shows post id, not title?**
   a. You're using `{acf_rel}` directly: that's the raw post id array. Wrap in a Posts loop or use `:array_value|` patterns.

5. **Loop-scope tag wrong: shows outer page data?**
   a. You're using a Posts-loop tag inside a Users loop (or vice versa). Use provider-specific tags.

6. **Tag works on one page, not another?**
   a. Plugin provider not active on that page (rare: plugin scope usually global).
   b. Post type doesn't have the field assigned (ACF field group scope).

## Never do

- Mix `:` and `|` as if they're interchangeable. Colon is the separator; pipe is only for `array_value|key`.
- Expect `{post_title}` inside a Users loop to give you the user's name. Use `{wp_user_display_name}`.
- Use `{echo:...}` as a general-purpose function caller without seeing the `bricks-custom-code` skill first: echo is a security surface.
- Hard-code the tag name for a third-party field without confirming in the builder's dynamic-data picker. Prefixes change.
- Assume `bricks/dynamic_data/allowed_keys` protects post meta. It only controls parser keys; avoid exposing sensitive meta through `cf_` tags or custom providers.
