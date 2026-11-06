---
name: bricks-custom-dynamic-data-providers
description: "Add or debug custom Bricks dynamic-data tags in a child theme or plugin, including picker registration, rendering and loop context."
---

**Requires:** Bricks 2.4+ with the Abilities API enabled

# Bricks: custom dynamic-data tags

Use public hooks for ordinary custom tags. The internal `Providers::register()` API
takes provider slugs, not instances, and constructs Bricks-namespaced provider
classes. It is not a general third-party registration API.

## Public text-tag recipe

Read [the executable example](assets/custom-text-tag.php) when implementing a simple
post-backed text tag. Adapt its namespace, tag, explicitly public data lookup and
text domain to the project; load the adapted file once from the child theme/plugin.
It deliberately supports one exact text tag, without modifiers or image/link values.

The three rendering paths matter:

- `bricks/dynamic_tags_list` makes a tag discoverable in the picker.
- `bricks/dynamic_data/render_tag` resolves an individual tag; preserve non-string
  results and unrecognized tags from other providers.
- `bricks/dynamic_data/render_content` and `bricks/frontend/render_data` handle tags
  embedded in content. Registering the picker/individual-tag callback alone does
  not implement these paths. Preserve surrounding HTML and unrelated expressions.

The example returns scalar data from individual resolution and escapes its text
replacement at the HTML-content boundary. Consumers of a raw individual value must
escape for their own output context. For image/link/array tags, implement the
specific Bricks value shape and escaping instead of reusing the text substitution.
See [the public custom-tag contract](https://academy.bricksbuilder.io/developer/dynamic-data/create-your-own-dynamic-data-tag/).

## Context and modifiers

Use the post supplied by the renderer. A preview post, page post and loop item are
not interchangeable. For term/user/provider loops, inspect `Bricks\Query`'s actual
loop object/type and define the intended behavior when no applicable context exists.
Do not substitute a guessed post ID or rely on unsupported parser context overrides.

If adding modifiers, parse only the syntax your tag advertises and test malformed,
empty and nested input. Do not rewrite all braces in arbitrary page content. For a
core-style provider integration that really needs `Base`, read
[the internal provider reference](references/internal-provider.md); its lifecycle
and formatting contract are different from public hook callbacks.

Cache expensive lookups using every input that can change the result, including
post/user/locale/arguments as applicable, and invalidate on the corresponding data
updates. Never expose secrets or user-private data through a public rendering tag.

## Verify

Test picker presence, direct tag rendering and a tag inside surrounding text/HTML;
include unrelated tags, non-string values and missing data. Verify the intended
frontend and Builder contexts, plus the actual loop when applicable. A post-only
`preview-dynamic-tag` call cannot certify arbitrary term/user/repeater row context.
The bundled example's isolated PHP test protects its callback behavior; it does not
replace a WordPress/Builder integration check for the adapted provider.

## Agency field notes

Deltas carried from the agency fork (vendor 0.1.3 does not contain them). Upstream these rather than editing the sections above.

A **dynamic-data provider** registers tags with Bricks' `{tag_name}` pipeline. Built-in providers cover WP core, ACF, Woo, JetEngine, Pods, Toolset, MetaBox, CMB2. Custom tags let you expose your plugin's data (membership levels, API-fetched values, computed metrics) in Bricks.

### The supported hook pattern

Use the public filters unless you are intentionally extending Bricks' internal provider registry. `Providers::register()` does **not** accept provider instances. It expects provider slugs and constructs classes named `Bricks\Integrations\Dynamic_Data\Providers\Provider_{Slug}` (`includes/integrations/dynamic-data/providers.php:32-45`, `:130-153`).
Minimal child-theme/plugin pattern:
add_filter( 'bricks/dynamic_tags_list', function( $tags ) {
add_filter( 'bricks/dynamic_data/render_tag', function( $value, $post, $context ) {
// At this priority, unknown tags usually arrive as "{tag:modifier}".
if ( substr( $raw, 0, 1 ) === '{' && substr( $raw, -1 ) === '}' ) {
$raw = substr( $raw, 1, -1 );
if ( ! in_array( $tag, [ 'my_plan_name', 'my_plan_price' ], true ) ) {
if ( $tag === 'my_plan_name' ) {
$term = get_term( $plan_id );
return $term && ! is_wp_error( $term ) ? $term->name : '';
return get_term_meta( $plan_id, 'price', true );
Why priority `20`: Bricks' own provider renderer is registered on `bricks/dynamic_data/render_tag` at priority `10` (`includes/integrations/dynamic-data/providers.php:96`). Running after it lets your callback handle only tags Bricks left unresolved.

### Tag structure

- `'dynamicType'`: constrain to a specific context (e.g., `'image'` for tags that only make sense for image fields).
- `'preview'`: a function returning a preview value shown in the builder.

### Builder picker: making tags discoverable

Tags appear in the builder's dynamic-data picker when they are returned through `bricks/dynamic_tags_list`. Internal `Base` providers do this through `register_tags()` and `Providers::add_tags_to_builder()`. Hook-based custom tags do it by adding rows to that filter directly. The picker groups by `group`; set meaningful provider names so your tags are easy to find.

### Related hooks

| `bricks/dynamic_data/register_providers` | Filter Bricks' internal provider slug list before registration |
| `bricks/dynamic_data/register_hook` | Change the WP hook (default `init`) Bricks uses for internal provider/tag registration |
| `bricks/dynamic_data/tags_registered` | Fires after all providers register; last chance to add/remove |
| `bricks/dynamic_data/render_tag` | Filter individual tag before fetching value |
| `bricks/dynamic_data/tag_value_parsed` | Action fired after a tag value is parsed |
| `bricks/dynamic_data/format_value` | Filter value after modifier application |
| `bricks/dynamic_data/allowed_keys` | Filter parser keys such as `@fallback`, `@sanitize`, `@key`, `@date`, `@from`, and `@to` |
See `hooks-reference` for the full list.

### Parser args

Users can pass supported parser args such as `@fallback:'N/A'`, `@sanitize:false`, or `@key:'title'` depending on the tag. Current Bricks does not support arbitrary `@post_id` context overrides in the parser. Your provider receives the `$post` chosen by the render context or loop.

### Caching provider results

Bricks doesn't cache your `get_tag_value` calls by default. On expensive lookups (API calls, complex joins):
$cache_key = "myplan_{$tag}_{$post->ID}";
$cached = wp_cache_get( $cache_key, 'myplan' );
if ( $cached !== false ) return $cached;
$value = $this->compute_value( $tag, $post );
wp_cache_set( $cache_key, $value, 'myplan', HOUR_IN_SECONDS );
add_action( 'save_post', function( $post_id ) {
wp_cache_delete( "myplan_my_plan_name_{$post_id}", 'myplan' );
wp_cache_delete( "myplan_my_plan_price_{$post_id}", 'myplan' );

### Silent-failure debug order

1. **Tag renders literally as `{my_plan_name}`?**
a. Your `bricks/dynamic_tags_list` row is missing, so the picker cannot expose it.
b. Your `bricks/dynamic_data/render_tag` callback is returning the original value instead of handling the tag.
c. For internal providers, `register_tags()` did not populate `$this->tags`, or the class name did not match Bricks' `Provider_{Slug}` convention.
2. **Tag shows in picker but resolves empty on frontend?**
a. Your render callback or `get_tag_value()` returns empty. Log `$post`, `$tag`, `$args` to confirm inputs.
b. `$post` is null in the current context: you're outside a loop.
3. **Tag works on single-post pages, empty on archives?**
a. Archive has no current `$post`. Handle the archive case (use `Query::get_loop_object()`).
a. `$args` not being read.
b. Your value-return is being overridden downstream by `bricks/dynamic_data/format_value`. Check filter callbacks.
5. **Value is correct in the builder preview but wrong on frontend?**
a. Context mismatch: builder uses a fallback `$post`, frontend uses the real one.

### Testing

// In a plugin test runner for an internal Base provider:
$provider = new Provider_My_Plan( 'my_plan' );
assert( isset( $provider->tags['my_plan_name'] ) );
$value = $provider->get_tag_value( 'my_plan_name', $post, [], 'text' );
assert( $value === 'Pro' );  // or whatever you expect
Manual: insert `{my_plan_name}` in a text element, view frontend, confirm it resolves.

### Never do

- Pass instantiated objects to `Providers::register()`: current source expects slugs, not instances.
- Rely on `bricks/dynamic_data/register_hook` to register a provider. It only changes the WP hook used by Bricks' internal provider registration.
- Return non-scalar values without testing the rendering context. Some contexts expect strings, some expect arrays.
- Assume modifiers are applied after your provider returns. Internal providers call `format_value_for_context()` themselves.
- Hit an external API synchronously in `get_tag_value` without caching. The tag resolves per-render: 100 loops x 1 API call = 100 cold fetches.
- Store sensitive values (tokens, passwords) in tags. Any authenticated builder user can query them via MCP or the picker.

### Related skills

- `dynamic-data`: tag-syntax reference and provider surface.
- `hooks-reference`: full dynamic-data hook list.
- `custom-elements` / `custom-controls`: the rest of the authoring surface.

## Academy reference

For custom dynamic data providers:
- **Custom Dynamic Providers**: https://developer.bricksbuilder.io/hooks/dynamic-data/
- **Provider Registration**: https://developer.bricksbuilder.io/hooks/dynamic-data/register/
- **Tag Registration**: https://developer.bricksbuilder.io/hooks/dynamic-data/tags/
