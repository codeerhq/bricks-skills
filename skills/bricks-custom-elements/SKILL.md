---
name: bricks-custom-elements
description: "Use when building custom Bricks elements in a child theme or plugin: \"register a new element\", \"my custom element doesn't show\", \"builder-preview differs from frontend\". Covers the base `Element` class contract, registration via `bricks/load_elements/after`, the render split, and builder-preview parity."
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

# Bricks: custom elements

A **custom element** is a PHP class extending `\Bricks\Element` that adds a new element type to the Bricks builder's element panel. Shipped via a child theme or plugin. This is the end-to-end contract.

## The minimal element

```php
<?php
namespace MyTheme\Bricks;

if ( ! defined( 'ABSPATH' ) ) exit;

class Pricing_Card extends \Bricks\Element {
    public $category     = 'general';       // Element panel category
    public $name         = 'pricing-card';  // Unique slug
    public $icon         = 'ti-layout-grid3-alt'; // Themify Icons class
    public $css_selector = '.pricing-card'; // Root selector for CSS rules
    public $scripts      = [ 'bricksPricingCard' ]; // frontend JS callbacks (optional)

    public function get_label() {
        return esc_html__( 'Pricing Card', 'my-theme' );
    }

    public function set_control_groups() {
        $this->control_groups['plan'] = [
            'title' => esc_html__( 'Plan', 'my-theme' ),
            'tab'   => 'content',
        ];
    }

    public function set_controls() {
        $this->controls['planName'] = [
            'group' => 'plan',
            'label' => esc_html__( 'Plan name', 'my-theme' ),
            'type'  => 'text',
            'default' => 'Pro',
        ];
        $this->controls['price'] = [
            'group' => 'plan',
            'label' => esc_html__( 'Price', 'my-theme' ),
            'type'  => 'text',
            'default' => '$29/mo',
        ];
    }

    public function render() {
        $name  = isset( $this->settings['planName'] ) ? $this->settings['planName']: '';
        $price = isset( $this->settings['price'] ) ? $this->settings['price']: '';

        $this->set_attribute( '_root', 'class', 'pricing-card' );
        $root = $this->render_attributes( '_root' );

        echo "<div {$root}>";
        echo '<h3>' . esc_html( $name ) . '</h3>';
        echo '<p class="price">' . esc_html( $price ) . '</p>';
        echo '</div>';
    }
}
```

Save as `your-theme/bricks/elements/pricing-card.php`.

## Registration

Hook into `bricks/load_elements/after`: fires in `includes/elements.php:263` after Bricks has loaded its own elements.

```php
add_action( 'bricks/load_elements/after', function() {
    require_once get_stylesheet_directory() . '/bricks/elements/pricing-card.php';
    \Bricks\Elements::register_element(
        get_stylesheet_directory() . '/bricks/elements/pricing-card.php',
        'pricing-card',
        'MyTheme\\Bricks\\Pricing_Card'
    );
} );
```

`Elements::register_element()` signature (`elements.php:219`):
- Arg 1: absolute file path (for reload detection)
- Arg 2: element name (must match class's `$name`)
- Arg 3: fully-qualified class name

**If you omit args 2 & 3**, Bricks auto-discovers the class via `get_declared_classes()`: works but is fragile. Explicit registration is better.

## Methods to override

The base `Element` class provides defaults. Override only what the element needs:

| Method | File:line | Purpose |
|---|---|---|
| `get_label()` | base.php | Return the translated element name. The base fallback derives a label from `$name`. |
| `set_control_groups()` | base.php:239 | Optional. Populate `$this->control_groups` array when you need custom groups. |
| `set_controls()` | base.php:246 | Populate `$this->controls` array for element settings. |
| `render()` | base.php:2772 | Frontend HTML output and PHP AJAX builder output for elements without an x-template. |
| `render_builder()` | base.php:2779 | Optional static method. Echoes the builder x-template script when you want a Vue-rendered preview. |

**Most elements override only** `get_label()` + `set_controls()` + `render()`. `set_control_groups()` only if you want tabs beyond the default `content` / `style`.

## Public properties

| Property | Type | Purpose |
|---|---|---|
| `$category` | string | `'general'` / `'layout'` / `'media'` / `'seo'` / `'woocommerce'` / custom: element panel group |
| `$name` | string | Unique slug (hyphen-case). Must match `register_element`'s arg 2. |
| `$icon` | string | Themify Icons class (default icon set in Bricks) |
| `$css_selector` | string | Selector used by Bricks' CSS generator to scope controls: usually the element's root class |
| `$scripts` | array | Names of JS callbacks Bricks should call on frontend init |
| `$nestable` | bool | Whether this element accepts arbitrary children. Default `false` (base.php:57) |
| `$tag` | string | Default HTML tag for the root wrapper (`'div'` typically) |
| `$controls` | array | Populated by `set_controls()` |
| `$settings` | array | Resolved settings for the current instance (populated by Bricks at render time) |
| `$is_frontend` | bool | True on frontend, false in builder context (base.php:40, 72) |

## Render parity: the builder-vs-frontend trap

Your `render()` method runs on the frontend. In the builder, Bricks chooses one of two render paths:

- If a script with ID `tmpl-bricks-element-{name}` exists, the iframe uses the Vue x-template (`src/vue/store/actions.js:2446`).
- If no x-template exists, the iframe uses `bricks-element-php`, which renders through PHP AJAX (`src/vue/store/actions.js:2451`, `src/vue/iframe.js:71`).

Two options:

### Option 1: Server-rendered in both contexts

Omit `render_builder()`. Bricks will not print an x-template for the element, so the builder falls back to the PHP render path.

Tradeoff: slower builder (round-trip per edit), but guaranteed visual parity.

### Option 2: Mirror logic in Vue x-template

Override static `render_builder()` and echo a script template that reproduces your PHP render logic client-side. `Builder::element_x_templates()` calls each registered element class's `render_builder()` in the builder iframe (`includes/builder.php:186`).

```html
<script type="text/x-template" id="tmpl-bricks-element-pricing-card">
    <div class="pricing-card">
        <h3>{{ settings.planName }}</h3>
        <p class="price">{{ settings.price }}</p>
    </div>
</script>
```

Tradeoff: faster builder, but you maintain two render paths.

**Rule of thumb:** if your element has heavy PHP logic (queries, complex formatting), use Option 1. If it's mostly presentation, use Option 2.

## Dynamic data inside custom elements

To support `{post_title}` inside your element's text control:

```php
$name = $this->render_dynamic_data( $this->settings['planName'] );
```

This runs the value through Bricks' dynamic-data pipeline. Without it, `{post_title}` renders literally.

## Root attributes: `render_attributes()`

Bricks generates classes, `id`, custom attributes from the element's panel (ID/Class control, custom attributes control). Emit via:

```php
$root_attrs = $this->render_attributes( '_root' );
echo "<div {$root_attrs}>...</div>";
```

`_root` is the default selector key. For non-root wrappers, define additional selectors in your controls with a `css` key and call `render_attributes('my-custom-selector')`.

## Frontend JS integration

If your element needs JS initialization:

1. Declare `$this->scripts = [ 'bricksPricingCard' ];` in your class.
2. Define `bricksPricingCard()` in a JS file enqueued on the frontend:

```js
function bricksPricingCard() {
  bricksQuerySelectorAll( '.pricing-card' ).forEach( el => {
    el.addEventListener( 'click', () => { /* ... */ } );
  } );
}
```

3. Enqueue the JS on `wp_enqueue_scripts` (child theme `functions.php`):

```php
add_action( 'wp_enqueue_scripts', function() {
    wp_enqueue_script( 'my-theme-bricks', get_stylesheet_directory_uri() . '/js/bricks.js', [ 'bricks-scripts' ], '1.0', true );
} );
```

Bricks calls every function named in any element's `$scripts` array on DOM-ready and after AJAX updates.

## Control types available (recap)

See the `bricks-custom-controls` skill for the complete list. The big ones: `text, textarea, number, select, checkbox, color, typography, background, border, box-shadow, spacing, dimensions, icon, image, repeater, code, query, query-list, link`.

## Common patterns

### Control visibility: `required`

Show one control only when another has a specific value:

```php
'highlightColor' => [
    'label'    => 'Highlight color',
    'type'     => 'color',
    'required' => [ 'highlight', '=', true ],  // only when `highlight` control is true
],
```

### Default value + CSS property binding

```php
'cardPadding' => [
    'label'   => 'Padding',
    'type'    => 'dimensions',
    'css'     => [
        [
            'property' => 'padding',
            'selector' => '',  // empty = apply to the css_selector root
        ],
    ],
    'default' => [ 'top' => '20px', 'right' => '20px', 'bottom' => '20px', 'left' => '20px' ],
],
```

Bricks generates CSS from `css` entries automatically: no need to emit style in `render()`.

## Nestable custom elements

Set `$this->nestable = true;` in the constructor (pre-1.9) or as a class property (1.9+). Then override `get_nestable_item()` to return the default child template.

See `bricks-nestable-elements` skill for the full contract.

## Silent-failure debug order

1. **Element doesn't appear in builder panel?**
   a. `register_element()` not called. Check the hook firing.
   b. Class namespace wrong. Fully-qualified name required.
   c. File not loaded: `require_once` path wrong.

2. **Element shows in builder but blank?**
   a. `render()` missing or empty.
   b. `render()` calling undefined methods / throwing. Check `wp-content/debug.log`.

3. **Dynamic tags render literally (`{post_title}` as text)?**
   a. Missing `render_dynamic_data( $value )` wrap.

4. **Controls show but changes don't persist?**
   a. Control name mismatch: the key in `set_controls()` must match what you read in `render()` via `$this->settings[key]`.

5. **Builder preview looks broken; frontend fine?**
   a. The x-template returned by `render_builder()` does not match `render()`, or the PHP fallback throws during the builder AJAX render.

6. **CSS from `css` controls not applying?**
   a. Selector in `css` entry doesn't match what `render()` emits. Bricks scopes to `.brxe-{name}` by default: verify the root class.

## Testing

- Local install with `WP_DEBUG` + `WP_DEBUG_LOG` on.
- Add the element to a test page.
- Frontend view -> check HTML output matches expectations.
- Builder view -> check preview matches frontend.
- Save -> reload builder -> values persist.
- MCP: `get-page-elements` includes your element in the tree, and `get-element-schema` returns its controls when the element is registered.

## Never do

- Echo `<script>` tags inside `render()`. Use proper enqueue via `wp_enqueue_script`.
- Skip `esc_html`/`esc_attr` on user-provided settings values. Bricks' settings pipeline sanitizes at save time but values can drift.
- Hard-code strings without `__()` / `esc_html__()`. Bricks is multi-lingual.
- Call WP template-loading functions (`get_header`, `get_footer`) inside `render()`: you're inside the page already.
- Register elements on plugins-loaded or similar early hooks. `bricks/load_elements/after` is the right moment.
- Override `$this->settings` directly in `render()`: it's populated by Bricks; treat as read-only.
- Skip `render_attributes('_root')` when emitting the root element. You lose the ID/Class panel bindings.

## Related skills

- `bricks-custom-controls`: control type reference and patterns.
- `bricks-custom-code`: where element PHP fits among the 7 extension points.
- `bricks-hooks-reference`: hooks like `bricks/element/render_attributes` for post-render tweaks.
- `bricks-child-theme-patterns`: where to put element files in a child theme.
