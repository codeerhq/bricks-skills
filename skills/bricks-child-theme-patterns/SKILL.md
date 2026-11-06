---
name: bricks-child-theme-patterns
description: "Set up or debug a Bricks child theme, including asset loading and extension registration. Use for theme-level PHP/files, not ordinary Builder edits."
---

**Requires:** Bricks 2.4+ with the Abilities API enabled

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

## Agency field notes

Deltas carried from the agency fork (vendor 0.1.3 does not contain them). Upstream these rather than editing the sections above.

Bricks is a theme, which means production sites should run on a **child theme**: Bricks core stays updatable, your custom code survives. Use this as the skeleton and convention set.

### Directory layout

wp-content/themes/my-bricks-child/
|-- style.css                        # Required header: WordPress reads this
|   |   `-- pricing-card.php         # Custom Bricks element
|   |   `-- class-my-provider.php    # Custom dynamic-data provider
|       `-- bricks.js                 # JS callbacks registered via $scripts
|   `-- elements/                    # Or keep elements here, whichever convention you prefer
`-- woocommerce/                     # Optional: Woo template overrides

### `style.css`: the required header

Theme Name: My Bricks Child
Theme URI: https://example.com
Description: Bricks child theme for Example.com
**`Template: bricks`** is the line that makes this a Bricks child theme. WordPress refuses to activate without it.

### `functions.php`: the skeleton

define( 'MY_CHILD_THEME_VERSION', '1.0.0' );
define( 'MY_CHILD_THEME_PATH', get_stylesheet_directory() );
define( 'MY_CHILD_THEME_URL', get_stylesheet_directory_uri() );
require_once MY_CHILD_THEME_PATH . '/includes/helpers.php';
require_once MY_CHILD_THEME_PATH . '/includes/hooks/bricks-hooks.php';
require_once MY_CHILD_THEME_PATH . '/includes/hooks/query-filters.php';
require_once MY_CHILD_THEME_PATH . '/includes/hooks/form-handlers.php';
MY_CHILD_THEME_URL . '/assets/css/custom.css',
[ 'bricks-frontend' ],  // load after Bricks' own CSS
// JS: for custom element callbacks
MY_CHILD_THEME_URL . '/assets/js/bricks.js',
[ 'bricks-scripts' ],  // load after Bricks' frontend.js
}, 20 );  // after Bricks itself registers (priority 10)
add_action( 'bricks/load_elements/after', function() {
MY_CHILD_THEME_PATH . '/includes/elements/pricing-card.php',
// Register custom dynamic-data provider.
if ( ! class_exists( '\Bricks\Integrations\Dynamic_Data\Providers\Base' ) ) return;
require_once MY_CHILD_THEME_PATH . '/includes/dynamic-data/class-my-provider.php';
\Bricks\Integrations\Dynamic_Data\Providers::register( [
'my_plugin' => new \MyTheme\Bricks\My_Provider( 'my_plugin' ),
}, 10001 );  // after Bricks' own providers register (priority 10000)

### Autoloader (optional, if you have many classes)

Manual `require_once` is fine for <10 files. Beyond that:
spl_autoload_register( function( $class ) {
$base_dir = MY_CHILD_THEME_PATH . '/includes/';
if ( strpos( $class, $prefix ) !== 0 ) return;
$relative = substr( $class, strlen( $prefix ) );
$file = $base_dir . strtolower( str_replace( '_', '-', str_replace( '\\', '/', $relative ) ) ) . '.php';
if ( file_exists( $file ) ) require_once $file;
Watch for **autoloader conflicts with Bricks' own**. Bricks registers its autoloader on `plugins_loaded`. Your autoloader should only match your own namespace prefix: never a catch-all pattern that could intercept Bricks class names.

### Hook priority conventions

Bricks hooks most of its own logic at default priority `10`. Rules:
| Your callback purpose | Recommended priority |
| Read-only observation (logging, debugging) | `5` or `10` |
| Mutating values before Bricks processes | `5` |
| Mutating values after Bricks' own mutations | `20` |
| "This must run last" | `99` or `PHP_INT_MAX` (rarely the right answer) |
| Registering custom elements | `10` on `bricks/load_elements/after` (default) |
| Registering dynamic-data providers | `10001` on `init` (Bricks registers at `10000`) |
| Enqueuing after Bricks | `20` on `wp_enqueue_scripts` |

### Asset enqueuing: the Bricks-specific quirks


#### Handle names to depend on

- `bricks-frontend`: Bricks' main CSS
- `bricks-scripts`: Bricks' main JS
- `bricks-icons`: Themify Icons font
- `bricks-theme-styles`: concatenated theme style CSS
Depending on these means your asset loads after Bricks'.

### Asset enqueuing: the Bricks-specific quirks


#### Load in builder preview

The Bricks builder preview iframe doesn't enqueue theme assets the same way. If you need your CSS in the preview too:
// Loads in both frontend and builder preview
wp_enqueue_style( 'my-child-builder', MY_CHILD_THEME_URL . '/assets/css/builder-preview.css' );
For **admin** (the Bricks builder panel itself, not preview):
add_action( 'admin_enqueue_scripts', function( $hook ) {
if ( strpos( $hook, 'bricks' ) === false ) return;
wp_enqueue_style( 'my-child-admin', MY_CHILD_THEME_URL . '/assets/css/admin.css' );

### Asset enqueuing: the Bricks-specific quirks


#### Avoid enqueuing heavy scripts on every page

A common anti-pattern: enqueuing a 200KB carousel library on every page when only one template uses it. Use conditional enqueue:
if ( ! is_page_template( 'my-carousel-page.php' ) && ! \Bricks\Helpers::post_has_element( 'my-carousel' ) ) return;
wp_enqueue_script( 'my-carousel-lib', MY_CHILD_THEME_URL . '/assets/js/carousel.js', [], '1.0', true );
`\Bricks\Helpers::post_has_element()` checks whether a post's element tree contains a specific element: efficient way to gate asset enqueue per-element-usage.

### WooCommerce template overrides

Overrides go in `my-bricks-child/woocommerce/{path mirroring Woo plugin}/`.
Example: override `woocommerce/templates/single-product/title.php`:
- Your file: `my-bricks-child/woocommerce/single-product/title.php`
Path must **mirror the Woo plugin structure exactly**. File-exists check is strict.
Don't override unless Bricks elements can't achieve what you need. Bricks' product elements cover most cases; template overrides are for when you need to change the inner HTML structure, not just styling.

### Theme support declarations

add_action( 'after_setup_theme', function() {
add_theme_support( 'post-thumbnails' );        // Usually already inherited from Bricks
add_theme_support( 'woocommerce' );            // If building a Woo site
add_theme_support( 'wc-product-gallery-zoom' );
add_theme_support( 'wc-product-gallery-lightbox' );
add_theme_support( 'wc-product-gallery-slider' );

### Common hook integration points


#### Modify query args site-wide

// includes/hooks/query-filters.php
if ( $element_id === 'related-products-loop' ) {

### Common hook integration points


#### Custom form action

// includes/hooks/form-handlers.php
add_action( 'bricks/form/action/notify_sales', function( $form ) {
$email = $fields['form-field-abc'] ?? '';
wp_mail( 'sales@example.com', 'New lead', $email );

### Common hook integration points


#### Whitelist echo-tag functions

// includes/hooks/bricks-hooks.php
'@^mytheme_',                // regex: all mytheme_ helpers
See `bricks-custom-code` skill for the full security model.

### Build pipeline (optional)

If you use npm/webpack/vite for SCSS or TS:
|-- assets/           # Compiled output (gitignored src if builds are CI)
Enqueue only the compiled `/assets/` output. Don't commit `node_modules` or `src/` to the production theme zip.

### Translation support

add_action( 'after_setup_theme', function() {
load_child_theme_textdomain( 'my-bricks-child', MY_CHILD_THEME_PATH . '/languages' );
Text domain `'my-bricks-child'` must match every `__()`, `esc_html__()`, `_e()` call in your theme code.

### Silent-failure debug order

1. **Child theme won't activate?**
a. `Template: bricks` missing from `style.css` header.
b. `Template: bricks-builder` or similar typo: the directory name is exactly `bricks`.
2. **Custom code in `functions.php` doesn't run?**
a. PHP parse error. Check `wp-content/debug.log` with `WP_DEBUG_LOG=true`.
b. Child theme not activated (check `WP Admin > Appearance > Themes`).
3. **Custom element doesn't appear in builder?**
a. `bricks/load_elements/after` hook not registered.
b. File path wrong in `register_element`.
4. **CSS doesn't apply?**
a. Missing dependency on `bricks-frontend`: your CSS loads before Bricks' and gets overridden.
b. Selector specificity too low. Bricks' emitted CSS can be very specific; use higher-specificity selectors or rely on the css-binding system via custom elements.
5. **Child-theme update wipes changes?**
a. You edited Bricks parent theme directly instead of the child. Never do this.
6. **Woo template override ignored?**
a. Path mirror wrong. Example: Woo's `templates/single-product/title.php` -> child `/woocommerce/single-product/title.php` (drop the `templates/` prefix).

### Never do

- Edit Bricks parent theme files directly. Updates will overwrite. **Always** use the child theme.
- Copy the entire Bricks parent into the child. You only override what you need; inheritance handles the rest.
- Register custom elements on `plugins_loaded`: Bricks classes aren't loaded yet.
- Ship a child theme with a `node_modules/` directory inside. Pre-build assets; ship only the compiled output.
- Skip the `Template: bricks` header in `style.css`: the theme won't install.
- Use autoloaders that match global class names (catch-all `spl_autoload_register`): they'll collide with Bricks' own.
- Put Bricks override logic in a mu-plugin when the child theme is the right place. mu-plugins are for cross-theme code.

### Related skills

- `custom-elements`: full element authoring contract.
- `custom-dynamic-data-providers`: provider authoring.
- `custom-code`: the 7 extension points and the CSS cascade order.
- `hooks-reference`: what to hook into.

## Academy reference

For child theme development:
- **Child Themes**: https://academy.bricksbuilder.io/chapters/the-builder/#child-themes
- **Theme Functions**: https://developer.bricksbuilder.io/hooks/theme/
- **Theme Overrides**: https://developer.bricksbuilder.io/hooks/theme/overrides/
