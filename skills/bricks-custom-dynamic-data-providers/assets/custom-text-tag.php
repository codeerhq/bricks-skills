<?php
namespace Example\BricksTags;

if ( ! defined( 'ABSPATH' ) ) exit;

/** Return only this example's intentionally public, scalar post label. */
function public_label( $post ) {
    if ( ! $post || ! isset( $post->ID ) ) return '';
    $label = get_post_meta( $post->ID, 'example_public_label', true );
    return is_scalar( $label ) ? (string) $label : '';
}

/** Resolve an individual tag without coercing another provider's result. */
function render_tag( $value, $post, $context = 'text' ) {
    if ( ! is_string( $value ) || ! in_array( $value, [ 'example_public_label', '{example_public_label}' ], true ) ) {
        return $value;
    }
    return $context === 'text' ? public_label( $post ) : '';
}

/** Replace this exact text tag, preserving surrounding HTML and other tags. */
function render_content( $content, $post, $context = 'text' ) {
    if ( ! is_string( $content ) || strpos( $content, '{example_public_label}' ) === false ) {
        return $content;
    }
    $replacement = $context === 'text' ? esc_html( public_label( $post ) ) : '';
    return str_replace( '{example_public_label}', $replacement, $content );
}

add_filter( 'bricks/dynamic_tags_list', function( $tags ) {
    $tags[] = [
        'name' => '{example_public_label}',
        'label' => __( 'Public project label', 'example-bricks-child' ),
        'group' => 'Example',
    ];
    return $tags;
} );
add_filter( 'bricks/dynamic_data/render_tag', __NAMESPACE__ . '\\render_tag', 20, 3 );
add_filter( 'bricks/dynamic_data/render_content', __NAMESPACE__ . '\\render_content', 20, 3 );
add_filter( 'bricks/frontend/render_data', __NAMESPACE__ . '\\render_content', 20, 2 );
