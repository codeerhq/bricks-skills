<?php
// Read-only state dump used for grading. Never writes.
global $wpdb;
$out = [ 'posts' => [], 'options' => [], 'filters' => [] ];
$metas = [ BRICKS_DB_PAGE_CONTENT, BRICKS_DB_PAGE_HEADER, BRICKS_DB_PAGE_FOOTER, BRICKS_DB_PAGE_SETTINGS, BRICKS_DB_TEMPLATE_TYPE, BRICKS_DB_TEMPLATE_SETTINGS ];
foreach ( get_posts( [ 'post_type' => array_values( get_post_types() ), 'post_status' => [ 'publish', 'draft', 'private', 'pending' ], 'numberposts' => -1, 'orderby' => 'ID', 'order' => 'ASC' ] ) as $p ) {
	$row = [ 'id' => $p->ID, 'type' => $p->post_type, 'title' => $p->post_title, 'slug' => $p->post_name, 'status' => $p->post_status, 'meta' => [] ];
	foreach ( $metas as $k ) {
		$v = get_post_meta( $p->ID, $k, true );
		if ( $v !== '' && $v !== [] ) {
			$row['meta'][ $k ] = $v;
		}
	}
	if ( $row['meta'] || in_array( $p->post_type, [ 'page', 'bricks_template' ], true ) ) {
		$out['posts'][] = $row;
	} else {
		$out['other'][ $p->post_type ] = ( $out['other'][ $p->post_type ] ?? 0 ) + 1;
	}
}
foreach ( [ BRICKS_DB_GLOBAL_CLASSES, BRICKS_DB_GLOBAL_CLASSES_CATEGORIES, BRICKS_DB_THEME_STYLES, BRICKS_DB_GLOBAL_VARIABLES, BRICKS_DB_GLOBAL_VARIABLES_CATEGORIES, BRICKS_DB_COLOR_PALETTE, BRICKS_DB_COMPONENTS, BRICKS_DB_GLOBAL_ELEMENTS, BRICKS_DB_GLOBAL_SETTINGS ] as $o ) {
	$out['options'][ $o ] = get_option( $o, null );
}
$idx = $wpdb->prefix . 'bricks_filters_index';
$el  = $wpdb->prefix . 'bricks_filters_element';
$job = $wpdb->prefix . 'bricks_filters_index_job';
foreach ( [ 'index' => $idx, 'element' => $el, 'job' => $job ] as $k => $t ) {
	$out['filters'][ $k ] = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $t ) ) === $t ? (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$t}" ) : null; // phpcs:ignore
}
$out['menus'] = array_map( static function ( $m ) { return [ 'id' => $m->term_id, 'name' => $m->name, 'items' => array_map( static function ( $i ) { return [ $i->title, $i->url ]; }, wp_get_nav_menu_items( $m->term_id ) ?: [] ) ]; }, wp_get_nav_menus() );
echo wp_json_encode( $out );
