---
name: custom-dynamic-data-providers
description: "Use when adding custom Bricks dynamic-data tags in a child theme or plugin: \"add a custom tag\", \"integrate my plugin's data with Bricks dynamic tags\", \"register a provider class\". Covers the supported hook pattern, the internal `Base` provider contract, tag lifecycle, and scope binding in loops."
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

# Bricks: custom dynamic-data providers

A **dynamic-data provider** registers tags with Bricks' `{tag_name}` pipeline. Built-in providers cover WP core, ACF, Woo, JetEngine, Pods, Toolset, MetaBox, CMB2. Custom tags let you expose your plugin's data (membership levels, API-fetched values, computed metrics) in Bricks.

## The supported hook pattern

Use the public filters unless you are intentionally extending Bricks' internal provider registry. `Providers::register()` does **not** accept provider instances. It expects provider slugs and constructs classes named `Bricks\Integrations\Dynamic_Data\Providers\Provider_{Slug}` (`includes/integrations/dynamic-data/providers.php:32-45`, `:130-153`).

Minimal child-theme/plugin pattern:

```php
<?php
namespace MyPlugin\Bricks;

if ( ! defined( 'ABSPATH' ) ) exit;

add_filter( 'bricks/dynamic_tags_list', function( $tags ) {
    $tags[] = [
        'name'     => '{my_plan_name}',
        'label'    => 'Current plan name',
        'group'    => 'MyPlugin',
        'provider' => 'myplugin',
    ];

    $tags[] = [
        'name'     => '{my_plan_price}',
        'label'    => 'Current plan price',
        'group'    => 'MyPlugin',
        'provider' => 'myplugin',
    ];

    return $tags;
} );

add_filter( 'bricks/dynamic_data/render_tag', function( $value, $post, $context ) {
    $raw = trim( (string) $value );

    // At this priority, unknown tags usually arrive as "{tag:modifier}".
    if ( substr( $raw, 0, 1 ) === '{' && substr( $raw, -1 ) === '}' ) {
        $raw = substr( $raw, 1, -1 );
    }

    $parts = explode( ':', $raw );
    $tag   = array_shift( $parts );

    if ( ! in_array( $tag, [ 'my_plan_name', 'my_plan_price' ], true ) ) {
        return $value;
    }

    if ( ! $post ) {
        return '';
    }

    $plan_id = get_post_meta( $post->ID, '_my_plan_id', true );
    if ( ! $plan_id ) {
        return '';
    }

    if ( $tag === 'my_plan_name' ) {
        $term = get_term( $plan_id );
        return $term && ! is_wp_error( $term ) ? $term->name : '';
    }

    return get_term_meta( $plan_id, 'price', true );
}, 20, 3 );
```

Why priority `20`: Bricks' own provider renderer is registered on `bricks/dynamic_data/render_tag` at priority `10` (`includes/integrations/dynamic-data/providers.php:96`). Running after it lets your callback handle only tags Bricks left unresolved.

## Internal provider registry

Bricks' internal registry is fed by `bricks/dynamic_data/register_providers` (`includes/init.php:158-169`). If you add a slug there, Bricks will try to instantiate a class named:

```
Bricks\Integrations\Dynamic_Data\Providers\Provider_{Slug}
```

That is useful for core/provider-style integrations, but it is not a normal third-party instance-registration API. Do not pass instantiated objects to `Providers::register()`.

## The `Base` provider contract

From `/includes/integrations/dynamic-data/providers/base.php`. Use this only when you are matching Bricks' internal provider-class convention.

| Method | Must override | Purpose |
|---|---|---|
| `__construct( $name )` | No (sets `$this->name`) | Called with the provider name |
| `register_tags()` | **Yes** | Populate `$this->tags` array |
| `get_tag_value( $tag, $post, $args, $context )` | **Yes** | Return a value for a tag name |

Signature details:

```php
public function get_tag_value( $tag, $post, $args, $context );
```

- `$tag`: tag name without braces (e.g., `my_plan_name`)
- `$post`: WP_Post object (current loop iteration, or current main query post)
- `$args`: array of modifiers after the colon (`['format', 'M j, Y']` for `{tag:format:M j, Y}`)
- `$context`: Bricks render context: `'text'`, `'link'`, `'image'`, etc.

Return scalar (string / int / float). For arrays (images, galleries), return the appropriate shape Bricks expects per context.

## Tag structure

Each entry in `$this->tags`:

```php
$this->tags['key'] = [
    'name'     => '{key}',           // canonical tag syntax
    'label'    => 'Human label',     // shown in the picker
    'group'    => 'MyPlugin',        // provider group in picker
    'deprecated' => false,           // optional
];
```

Advanced keys:
- `'dynamicType'`: constrain to a specific context (e.g., `'image'` for tags that only make sense for image fields).
- `'preview'`: a function returning a preview value shown in the builder.

## Scope binding: loop context

`$post` in `get_tag_value` is the **current post context** at tag-resolution time. Inside a Posts loop, that's the iteration post. Outside, it's the page's main-query post.

For Users or Terms loops, `$post` may be null. Check with `Query::get_loop_object()` and `Query::get_loop_object_type()`:

```php
public function get_tag_value( $tag, $post, $args, $context ) {
    $loop_object      = \Bricks\Query::get_loop_object();
    $loop_object_type = \Bricks\Query::get_loop_object_type();

    if ( $loop_object_type === 'user' ) {
        $user = $loop_object;  // WP_User
        return get_user_meta( $user->ID, '_my_plan_id', true );
    }

    if ( $post ) {
        return get_post_meta( $post->ID, '_my_plan_id', true );
    }

    return '';
}
```

## Modifier support

Modifiers come in via `$args`. For `{my_plan_price:format:2}`:

```php
$args = [ 'format', '2' ];
```

Implement modifier logic in your `get_tag_value`:

```php
    public function get_tag_value( $tag, $post, $args, $context ) {
        $raw = $this->get_raw_value( $tag, $post );

        if ( in_array( 'format', $args, true ) ) {
            $decimals = (int) ( $args[ array_search( 'format', $args ) + 1 ] ?? 2 );
            return number_format( (float) $raw, $decimals );
    }

    return $raw;
}
```

For internal `Base` providers, call `$this->format_value_for_context( $value, $tag, $post_id, $filters, $context )` before returning when you want Bricks' standard text/link/image formatting. The provider registry does not apply that formatting after your `get_tag_value()` returns; built-in providers call it themselves (`includes/integrations/dynamic-data/providers/base.php:246-392`).

## Builder picker: making tags discoverable

Tags appear in the builder's dynamic-data picker when they are returned through `bricks/dynamic_tags_list`. Internal `Base` providers do this through `register_tags()` and `Providers::add_tags_to_builder()`. Hook-based custom tags do it by adding rows to that filter directly. The picker groups by `group`; set meaningful provider names so your tags are easy to find.

## Related hooks

| Hook | Purpose |
|---|---|
| `bricks/dynamic_data/register_providers` | Filter Bricks' internal provider slug list before registration |
| `bricks/dynamic_data/register_hook` | Change the WP hook (default `init`) Bricks uses for internal provider/tag registration |
| `bricks/dynamic_data/tags_registered` | Fires after all providers register; last chance to add/remove |
| `bricks/dynamic_data/render_tag` | Filter individual tag before fetching value |
| `bricks/dynamic_data/tag_value_parsed` | Action fired after a tag value is parsed |
| `bricks/dynamic_data/format_value` | Filter value after modifier application |
| `bricks/dynamic_data/allowed_keys` | Filter parser keys such as `@fallback`, `@sanitize`, `@key`, `@date`, `@from`, and `@to` |

See `hooks-reference` for the full list.

## Parser args

Users can pass supported parser args such as `@fallback:'N/A'`, `@sanitize:false`, or `@key:'title'` depending on the tag. Current Bricks does not support arbitrary `@post_id` context overrides in the parser. Your provider receives the `$post` chosen by the render context or loop.

## Caching provider results

Bricks doesn't cache your `get_tag_value` calls by default. On expensive lookups (API calls, complex joins):

```php
public function get_tag_value( $tag, $post, $args, $context ) {
    if ( ! $post ) return '';

    $cache_key = "myplan_{$tag}_{$post->ID}";
    $cached = wp_cache_get( $cache_key, 'myplan' );
    if ( $cached !== false ) return $cached;

    $value = $this->compute_value( $tag, $post );
    wp_cache_set( $cache_key, $value, 'myplan', HOUR_IN_SECONDS );
    return $value;
}
```

Invalidate on relevant updates:

```php
add_action( 'save_post', function( $post_id ) {
    wp_cache_delete( "myplan_my_plan_name_{$post_id}", 'myplan' );
    wp_cache_delete( "myplan_my_plan_price_{$post_id}", 'myplan' );
} );
```

## Silent-failure debug order

1. **Tag renders literally as `{my_plan_name}`?**
   a. Your `bricks/dynamic_tags_list` row is missing, so the picker cannot expose it.
   b. Your `bricks/dynamic_data/render_tag` callback is returning the original value instead of handling the tag.
   c. For internal providers, `register_tags()` did not populate `$this->tags`, or the class name did not match Bricks' `Provider_{Slug}` convention.

2. **Tag shows in picker but resolves empty on frontend?**
   a. Your render callback or `get_tag_value()` returns empty. Log `$post`, `$tag`, `$args` to confirm inputs.
   b. `$post` is null in the current context: you're outside a loop.

3. **Tag works on single-post pages, empty on archives?**
   a. Archive has no current `$post`. Handle the archive case (use `Query::get_loop_object()`).

4. **Modifier ignored?**
   a. `$args` not being read.
   b. Your value-return is being overridden downstream by `bricks/dynamic_data/format_value`. Check filter callbacks.

5. **Value is correct in the builder preview but wrong on frontend?**
   a. Context mismatch: builder uses a fallback `$post`, frontend uses the real one.

## Testing

```php
// In a plugin test runner for an internal Base provider:
$provider = new Provider_My_Plan( 'my_plan' );
$provider->register_tags();
assert( isset( $provider->tags['my_plan_name'] ) );

$post = get_post( 42 );
$value = $provider->get_tag_value( 'my_plan_name', $post, [], 'text' );
assert( $value === 'Pro' );  // or whatever you expect
```

Manual: insert `{my_plan_name}` in a text element, view frontend, confirm it resolves.

## Never do

- Pass instantiated objects to `Providers::register()`: current source expects slugs, not instances.
- Rely on `bricks/dynamic_data/register_hook` to register a provider. It only changes the WP hook used by Bricks' internal provider registration.
- Return non-scalar values without testing the rendering context. Some contexts expect strings, some expect arrays.
- Assume modifiers are applied after your provider returns. Internal providers call `format_value_for_context()` themselves.
- Hit an external API synchronously in `get_tag_value` without caching. The tag resolves per-render: 100 loops x 1 API call = 100 cold fetches.
- Store sensitive values (tokens, passwords) in tags. Any authenticated builder user can query them via MCP or the picker.

## Related skills

- `dynamic-data`: tag-syntax reference and provider surface.
- `hooks-reference`: full dynamic-data hook list.
- `custom-elements` / `custom-controls`: the rest of the authoring surface.
