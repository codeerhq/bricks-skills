<?php
/** Isolated recipe contracts; these do not verify WordPress lifecycle/rendering. */
define( 'ABSPATH', __DIR__ );
$filters = [];
$labels = [ 42 => 'Plan <Pro>', 43 => [ 'unexpected' ] ];
function add_filter( $hook, $callback, $priority = 10, $args = 1 ) {
    global $filters;
    $filters[ $hook ][] = [ $callback, $priority, $args ];
}
function get_post_meta( $id, $key, $single ) {
    global $labels;
    return $key === 'example_public_label' ? ( $labels[ $id ] ?? '' ) : '';
}
function esc_html( $value ) { return htmlspecialchars( $value, ENT_QUOTES, 'UTF-8' ); }
function __( $value, $domain ) { return $value; }
function apply_recipe_filter( $hook, ...$args ) {
    global $filters;
    foreach ( $filters[ $hook ] ?? [] as $registered ) {
        $args[0] = call_user_func_array( $registered[0], array_slice( $args, 0, $registered[2] ) );
    }
    return $args[0];
}
function same( $expected, $actual, $label ) {
    if ( $expected !== $actual ) throw new RuntimeException( $label );
}
require __DIR__ . '/../skills/bricks-custom-dynamic-data-providers/assets/custom-text-tag.php';
$post = (object) [ 'ID' => 42 ];
same( 'Plan <Pro>', apply_recipe_filter( 'bricks/dynamic_data/render_tag', '{example_public_label}', $post, 'text' ), 'Direct tag' );
same( 'Plan <Pro>', apply_recipe_filter( 'bricks/dynamic_data/render_tag', 'example_public_label', $post, 'text' ), 'Unwrapped tag' );
same( [ 123 ], apply_recipe_filter( 'bricks/dynamic_data/render_tag', [ 123 ], $post, 'image' ), 'Preserve other provider arrays' );
same( '{unrelated}', apply_recipe_filter( 'bricks/dynamic_data/render_tag', '{unrelated}', $post, 'text' ), 'Preserve unknown tags' );
same( '', apply_recipe_filter( 'bricks/dynamic_data/render_tag', '{example_public_label}', null, 'text' ), 'Missing post' );
same( '', apply_recipe_filter( 'bricks/dynamic_data/render_tag', '{example_public_label}', (object) [ 'ID' => 43 ], 'text' ), 'Reject nonscalar label' );
same( '', apply_recipe_filter( 'bricks/dynamic_data/render_tag', '{example_public_label}', $post, 'image' ), 'Unsupported context' );
$input = '<b>{example_public_label}</b> {post_title} {example_public_label}';
$expected = '<b>Plan &lt;Pro&gt;</b> {post_title} Plan &lt;Pro&gt;';
same( $expected, apply_recipe_filter( 'bricks/dynamic_data/render_content', $input, $post, 'text' ), 'Embedded tag escaping and unrelated content' );
same( $expected, apply_recipe_filter( 'bricks/frontend/render_data', $input, $post ), 'Frontend content path' );
$tags = apply_recipe_filter( 'bricks/dynamic_tags_list', [ [ 'name' => '{existing}' ] ] );
same( '{existing}', $tags[0]['name'], 'Preserve picker rows' );
same( '{example_public_label}', $tags[1]['name'], 'Register picker row' );

// Execute the actual documented allow-list callback, not a duplicate implementation.
$skill = file_get_contents( __DIR__ . '/../skills/bricks-child-theme-patterns/SKILL.md' );
preg_match_all( '/```php\n(.*?)```/s', $skill, $blocks );
$loaded = false;
foreach ( $blocks[1] as $code ) {
    if ( strpos( $code, 'bricks/code/echo_function_names' ) !== false ) {
        eval( $code );
        $loaded = true;
    }
}
if ( ! $loaded ) throw new RuntimeException( 'Allow-list recipe was not found' );
same( [ 'example_public_label' ], apply_recipe_filter( 'bricks/code/echo_function_names', 'unapproved_function' ), 'Do not authorize requested callback' );
same( [ 'existing_public_function', 'example_public_label' ], apply_recipe_filter( 'bricks/code/echo_function_names', [ 'existing_public_function' ] ), 'Preserve existing allow-list' );
same( [ 'example_public_label' ], apply_recipe_filter( 'bricks/code/echo_function_names', false ), 'Handle nonarray previous callback' );
echo "Passed 14 executable recipe assertions.\n";
