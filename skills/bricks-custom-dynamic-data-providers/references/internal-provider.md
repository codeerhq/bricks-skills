# Internal provider integration

Use only when extending the Bricks internal registry against the installed source.
For ordinary custom tags, use the public-hook example linked from the skill.

## Internal provider registry

Bricks' internal registry is fed by `bricks/dynamic_data/register_providers` (`includes/init.php`). If you add a slug there, Bricks will try to instantiate a class named:

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
    'provider' => $this->name,       // registry lookup for get_tag_value()
];
```

Omit `deprecated` for visible tags: Bricks checks whether that key exists, so even
`false` excludes the tag from the picker. Inspect the installed picker/provider
contract before adding optional metadata; do not assume a preview callback or
context restriction is supported as a tag-list key.

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
        $decimals = (int) ( $args[ array_search( 'format', $args, true ) + 1 ] ?? 2 );
        return number_format( (float) $raw, $decimals );
    }

    return $raw;
}
```

For internal `Base` providers, call `$this->format_value_for_context( $value, $tag, $post_id, $filters, $context )` before returning when you want Bricks' standard text/link/image formatting. The provider registry does not apply that formatting after your `get_tag_value()` returns; built-in providers call it themselves (`includes/integrations/dynamic-data/providers/base.php`).
