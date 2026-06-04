---
name: bricks-child-theme-patterns
description: "Use when building a Bricks child theme, scaffolding a new one, or debugging \"my child-theme code doesn't run\": \"set up a child theme for Bricks\", \"where do custom elements go?\", \"how do I override a Bricks function?\". Covers the directory structure, `functions.php` skeleton, autoloader patterns, hook priorities, asset enqueuing, and `woocommerce/` template overrides."
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

# Bricks: child theme patterns

Bricks is a theme, which means production sites should run on a **child theme**: Bricks core stays updatable, your custom code survives. Use this as the skeleton and convention set.

## Directory layout

Minimum:

```
wp-content/themes/my-bricks-child/
|-- style.css                        # Required header: WordPress reads this
|-- functions.php                    # Main entrypoint
`-- assets/
    |-- css/
    `-- js/
```

Typical production layout:

```
my-bricks-child/
|-- style.css
|-- functions.php
|-- includes/
|   |-- class-autoloader.php
|   |-- elements/
|   |   `-- pricing-card.php         # Custom Bricks element
|   |-- dynamic-data/
|   |   `-- class-my-provider.php    # Custom dynamic-data provider
|   |-- hooks/
|   |   |-- bricks-hooks.php
|   |   |-- query-filters.php
|   |   `-- form-handlers.php
|   `-- helpers.php
|-- assets/
|   |-- css/
|   |   `-- custom.css
|   `-- js/
|       `-- bricks.js                 # JS callbacks registered via $scripts
|-- bricks/
|   `-- elements/                    # Or keep elements here, whichever convention you prefer
`-- woocommerce/                     # Optional: Woo template overrides
    `-- single-product/
        `-- title.php
```

## `style.css`: the required header

```css
/*
Theme Name: My Bricks Child
Theme URI: https://example.com
Description: Bricks child theme for Example.com
Author: Your Name
Template: bricks
Version: 1.0.0
*/
```

**`Template: bricks`** is the line that makes this a Bricks child theme. WordPress refuses to activate without it.

## `functions.php`: the skeleton

```php
<?php
if ( ! defined( 'ABSPATH' ) ) exit;

define( 'MY_CHILD_THEME_VERSION', '1.0.0' );
define( 'MY_CHILD_THEME_PATH', get_stylesheet_directory() );
define( 'MY_CHILD_THEME_URL', get_stylesheet_directory_uri() );

// Load custom code.
require_once MY_CHILD_THEME_PATH . '/includes/helpers.php';
require_once MY_CHILD_THEME_PATH . '/includes/hooks/bricks-hooks.php';
require_once MY_CHILD_THEME_PATH . '/includes/hooks/query-filters.php';
require_once MY_CHILD_THEME_PATH . '/includes/hooks/form-handlers.php';

// Enqueue child-theme assets.
add_action( 'wp_enqueue_scripts', function() {
    // CSS
    wp_enqueue_style(
        'my-child-theme',
        MY_CHILD_THEME_URL . '/assets/css/custom.css',
        [ 'bricks-frontend' ],  // load after Bricks' own CSS
        MY_CHILD_THEME_VERSION
    );
    // JS: for custom element callbacks
    wp_enqueue_script(
        'my-child-theme',
        MY_CHILD_THEME_URL . '/assets/js/bricks.js',
        [ 'bricks-scripts' ],  // load after Bricks' frontend.js
        MY_CHILD_THEME_VERSION,
        true
    );
}, 20 );  // after Bricks itself registers (priority 10)

// Register custom Bricks elements.
add_action( 'bricks/load_elements/after', function() {
    \Bricks\Elements::register_element(
        MY_CHILD_THEME_PATH . '/includes/elements/pricing-card.php',
        'pricing-card',
        '\\MyTheme\\Bricks\\Pricing_Card'
    );
} );

// Register custom dynamic-data provider.
add_action( 'init', function() {
    if ( ! class_exists( '\Bricks\Integrations\Dynamic_Data\Providers\Base' ) ) return;

    require_once MY_CHILD_THEME_PATH . '/includes/dynamic-data/class-my-provider.php';
    \Bricks\Integrations\Dynamic_Data\Providers::register( [
        'my_plugin' => new \MyTheme\Bricks\My_Provider( 'my_plugin' ),
    ] );
}, 10001 );  // after Bricks' own providers register (priority 10000)
```

## Autoloader (optional, if you have many classes)

Manual `require_once` is fine for <10 files. Beyond that:

```php
// includes/class-autoloader.php
namespace MyTheme\Bricks;

spl_autoload_register( function( $class ) {
    $prefix = 'MyTheme\\Bricks\\';
    $base_dir = MY_CHILD_THEME_PATH . '/includes/';

    if ( strpos( $class, $prefix ) !== 0 ) return;

    $relative = substr( $class, strlen( $prefix ) );
    $file = $base_dir . strtolower( str_replace( '_', '-', str_replace( '\\', '/', $relative ) ) ) . '.php';

    if ( file_exists( $file ) ) require_once $file;
} );
```

Watch for **autoloader conflicts with Bricks' own**. Bricks registers its autoloader on `plugins_loaded`. Your autoloader should only match your own namespace prefix: never a catch-all pattern that could intercept Bricks class names.

## Hook priority conventions

Bricks hooks most of its own logic at default priority `10`. Rules:

| Your callback purpose | Recommended priority |
|---|---|
| Read-only observation (logging, debugging) | `5` or `10` |
| Mutating values before Bricks processes | `5` |
| Mutating values after Bricks' own mutations | `20` |
| "This must run last" | `99` or `PHP_INT_MAX` (rarely the right answer) |
| Registering custom elements | `10` on `bricks/load_elements/after` (default) |
| Registering dynamic-data providers | `10001` on `init` (Bricks registers at `10000`) |
| Enqueuing after Bricks | `20` on `wp_enqueue_scripts` |

## Asset enqueuing: the Bricks-specific quirks

### Handle names to depend on

- `bricks-frontend`: Bricks' main CSS
- `bricks-scripts`: Bricks' main JS
- `bricks-icons`: Themify Icons font
- `bricks-theme-styles`: concatenated theme style CSS

Depending on these means your asset loads after Bricks'.

### Load in builder preview

The Bricks builder preview iframe doesn't enqueue theme assets the same way. If you need your CSS in the preview too:

```php
add_action( 'wp_enqueue_scripts', function() {
    // Loads in both frontend and builder preview
    wp_enqueue_style( 'my-child-builder', MY_CHILD_THEME_URL . '/assets/css/builder-preview.css' );
} );
```

For **admin** (the Bricks builder panel itself, not preview):

```php
add_action( 'admin_enqueue_scripts', function( $hook ) {
    if ( strpos( $hook, 'bricks' ) === false ) return;
    wp_enqueue_style( 'my-child-admin', MY_CHILD_THEME_URL . '/assets/css/admin.css' );
} );
```

### Avoid enqueuing heavy scripts on every page

A common anti-pattern: enqueuing a 200KB carousel library on every page when only one template uses it. Use conditional enqueue:

```php
add_action( 'wp_enqueue_scripts', function() {
    if ( ! is_page_template( 'my-carousel-page.php' ) && ! \Bricks\Helpers::post_has_element( 'my-carousel' ) ) return;
    wp_enqueue_script( 'my-carousel-lib', MY_CHILD_THEME_URL . '/assets/js/carousel.js', [], '1.0', true );
} );
```

`\Bricks\Helpers::post_has_element()` checks whether a post's element tree contains a specific element: efficient way to gate asset enqueue per-element-usage.

## WooCommerce template overrides

Overrides go in `my-bricks-child/woocommerce/{path mirroring Woo plugin}/`.

Example: override `woocommerce/templates/single-product/title.php`:
- Your file: `my-bricks-child/woocommerce/single-product/title.php`

Path must **mirror the Woo plugin structure exactly**. File-exists check is strict.

Don't override unless Bricks elements can't achieve what you need. Bricks' product elements cover most cases; template overrides are for when you need to change the inner HTML structure, not just styling.

## Theme support declarations

```php
add_action( 'after_setup_theme', function() {
    add_theme_support( 'post-thumbnails' );        // Usually already inherited from Bricks
    add_theme_support( 'woocommerce' );            // If building a Woo site
    add_theme_support( 'wc-product-gallery-zoom' );
    add_theme_support( 'wc-product-gallery-lightbox' );
    add_theme_support( 'wc-product-gallery-slider' );
} );
```

## Common hook integration points

### Modify query args site-wide

```php
// includes/hooks/query-filters.php
add_filter( 'bricks/posts/query_vars', function( $args, $settings, $element_id ) {
    if ( $element_id === 'related-products-loop' ) {
        $args['meta_query'] = [
            [
                'key'     => '_featured',
                'value'   => 'yes',
                'compare' => '=',
            ],
        ];
    }
    return $args;
}, 10, 3 );
```

### Custom form action

```php
// includes/hooks/form-handlers.php
add_action( 'bricks/form/action/notify_sales', function( $form ) {
    $fields = $form->get_fields();
    $email = $fields['form-field-abc'] ?? '';
    if ( ! $email ) {
        $form->set_result( [
            'action'  => 'notify_sales',
            'type'    => 'danger',
            'message' => 'Email required.',
        ] );
        return;
    }

    wp_mail( 'sales@example.com', 'New lead', $email );
} );
```

### Whitelist echo-tag functions

```php
// includes/hooks/bricks-hooks.php
add_filter( 'bricks/code/echo_function_names', function( $functions ) {
    return array_merge( $functions, [
        '@^mytheme_',                // regex: all mytheme_ helpers
        'get_the_date',
        'get_post_meta',
    ] );
} );
```

See `bricks-custom-code` skill for the full security model.

## Build pipeline (optional)

If you use npm/webpack/vite for SCSS or TS:

```
my-bricks-child/
|-- src/
|   |-- scss/
|   |   `-- main.scss
|   `-- ts/
|       `-- bricks.ts
|-- assets/           # Compiled output (gitignored src if builds are CI)
|   |-- css/main.css
|   `-- js/bricks.js
|-- package.json
`-- vite.config.js
```

Enqueue only the compiled `/assets/` output. Don't commit `node_modules` or `src/` to the production theme zip.

## Translation support

```php
add_action( 'after_setup_theme', function() {
    load_child_theme_textdomain( 'my-bricks-child', MY_CHILD_THEME_PATH . '/languages' );
} );
```

Text domain `'my-bricks-child'` must match every `__()`, `esc_html__()`, `_e()` call in your theme code.

## Silent-failure debug order

1. **Child theme won't activate?**
   a. `Template: bricks` missing from `style.css` header.
   b. `Template: bricks-builder` or similar typo: the directory name is exactly `bricks`.

2. **Custom code in `functions.php` doesn't run?**
   a. PHP parse error. Check `wp-content/debug.log` with `WP_DEBUG_LOG=true`.
   b. Child theme not activated (check `WP Admin > Appearance > Themes`).

3. **Custom element doesn't appear in builder?**
   a. `bricks/load_elements/after` hook not registered.
   b. File path wrong in `register_element`.
   c. Class namespace typo.

4. **CSS doesn't apply?**
   a. Missing dependency on `bricks-frontend`: your CSS loads before Bricks' and gets overridden.
   b. Selector specificity too low. Bricks' emitted CSS can be very specific; use higher-specificity selectors or rely on the css-binding system via custom elements.

5. **Child-theme update wipes changes?**
   a. You edited Bricks parent theme directly instead of the child. Never do this.

6. **Woo template override ignored?**
   a. Path mirror wrong. Example: Woo's `templates/single-product/title.php` -> child `/woocommerce/single-product/title.php` (drop the `templates/` prefix).

## Never do

- Edit Bricks parent theme files directly. Updates will overwrite. **Always** use the child theme.
- Copy the entire Bricks parent into the child. You only override what you need; inheritance handles the rest.
- Register custom elements on `plugins_loaded`: Bricks classes aren't loaded yet.
- Ship a child theme with a `node_modules/` directory inside. Pre-build assets; ship only the compiled output.
- Skip the `Template: bricks` header in `style.css`: the theme won't install.
- Use autoloaders that match global class names (catch-all `spl_autoload_register`): they'll collide with Bricks' own.
- Put Bricks override logic in a mu-plugin when the child theme is the right place. mu-plugins are for cross-theme code.

## Related skills

- `custom-elements`: full element authoring contract.
- `custom-controls`: control types.
- `custom-dynamic-data-providers`: provider authoring.
- `custom-code`: the 7 extension points and the CSS cascade order.
- `hooks-reference`: what to hook into.
