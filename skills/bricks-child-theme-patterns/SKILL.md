---
name: bricks-child-theme-patterns
description: "Set up or debug a Bricks child theme, including asset loading and extension registration. Use for theme-level PHP/files, not ordinary Builder edits."
---

# Bricks: child theme patterns

Keep theme-specific customizations in the existing child theme so parent updates
preserve them. A plugin can own functionality that should survive a theme change;
do not move working plugin code merely to enforce a directory preference.

## Minimal child theme

The child directory needs `style.css` with `Template: bricks` (the parent directory
name), and `functions.php` for the hooks actually used. Follow the existing layout;
extra autoloaders, build pipelines and empty include files are unnecessary.

```css
/*
Theme Name: Example Bricks Child
Template: bricks
Version: 1.0.0
Text Domain: example-bricks-child
*/
```

Enqueue the real child stylesheet, excluding the Builder panel:

```php
<?php
if ( ! defined( 'ABSPATH' ) ) exit;

add_action( 'wp_enqueue_scripts', function() {
    if ( bricks_is_builder_main() ) return;
    wp_enqueue_style(
        'example-bricks-child',
        get_stylesheet_directory_uri() . '/style.css',
        [ 'bricks-frontend' ],
        wp_get_theme()->get( 'Version' )
    );
}, 20 );
```

Add JavaScript/include files only when needed. With a build pipeline, enqueue
compiled output; retain source in development/version control and package runtime
assets. See the [child-theme guide](https://academy.bricksbuilder.io/developer/guides/child-theme/).

## Choose the extension lifecycle

| Task | Route |
|---|---|
| Custom element | `bricks/load_elements/after`, then `Bricks\Elements::register_element()` with real file/class; **bricks-custom-elements** |
| Element-specific assets | Its `enqueue_scripts()` method; a named `$scripts` initializer for Builder updates |
| Custom dynamic tags | Public picker, individual-tag and content-render filters; **bricks-custom-dynamic-data-providers** |
| Query customization | Appropriate hook scoped with its passed element ID; **bricks-hooks-reference** |
| Echo tag or Code element PHP | **bricks-custom-code** for execution and allow-list contracts |

Do not call `Providers::register()` with instances or invoke it late in `init`.
It takes slugs, constructs Bricks provider classes and schedules registration before
tags. Ordinary custom tags should use public filters. There is no
`Bricks\Helpers::post_has_element()` helper in Bricks 2.4; use the element asset
lifecycle instead. Choose hook priority from its actual dependencies, not a generic
before/after-10 rule. Restrict autoloaders to the project's own namespace.

## Focused query customization

Replace `qypost` with the actual six-character element ID, not its Structure label.

```php
add_filter( 'bricks/posts/query_vars', function( $args, $settings, $element_id ) {
    if ( $element_id === 'qypost' ) {
        $args['posts_per_page'] = 6;
    }
    return $args;
}, 10, 3 );
```

Preserve existing `meta_query`/`tax_query` clauses when adding constraints. Obtain
Woo featured-product semantics from its supported query/taxonomy contract instead
of assuming legacy `_featured` post meta.

## Echo allow-list

The initial `bricks/code/echo_function_names` value can be the requested callback
string. Merge only an existing array with explicitly approved public helpers:

```php
add_filter( 'bricks/code/echo_function_names', function( $allowed ) {
    $allowed = is_array( $allowed ) ? $allowed : [];
    return array_merge( $allowed, [ 'example_public_label' ] );
} );
```

Define the named helper before using it. Do not cast incoming strings to arrays:
that would allow the caller's requested function. Avoid broad prefixes or unrestricted
metadata access when only one public value is needed.

## Overrides and troubleshooting

For a Woo template override, mirror the path below the plugin's `templates/`
directory under the child's `woocommerce/`. Prefer Bricks elements/hooks when they
cover the request; track override compatibility with WooCommerce updates.

Check activation/header, PHP errors, actual paths/class names and registration
lifecycle. For styles, inspect loaded files, selectors and cascade before changing
specificity. Verify custom elements/tags on the frontend and Builder update path;
PHP syntax checks alone do not establish those behaviors.
