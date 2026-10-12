<?php
/**
 * Plugin Name: Eval fixture content types
 * Description: Project post type and taxonomy for the abilities evaluation fixture.
 */
add_action( 'init', static function () {
	register_post_type( 'project', [ 'label' => 'Projects', 'public' => true, 'has_archive' => false, 'show_in_rest' => true, 'supports' => [ 'title', 'editor', 'excerpt', 'thumbnail', 'custom-fields' ], 'rewrite' => [ 'slug' => 'work' ] ] );
	register_taxonomy( 'project_type', 'project', [ 'label' => 'Project types', 'public' => true, 'hierarchical' => true, 'show_in_rest' => true ] );
	add_filter( 'bricks/builder/supported_post_types', static function ( $t ) { $t[] = 'project'; return $t; } );
} );
