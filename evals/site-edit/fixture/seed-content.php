<?php
// Fixture content only: no users, no real people, no real addresses.
wp_set_current_user( 1 );
foreach ( get_posts( [ 'post_type' => [ 'post', 'page' ], 'post_status' => 'any', 'numberposts' => -1 ] ) as $p ) { wp_delete_post( $p->ID, true ); }
update_option( 'blogname', 'Harbour & Pine' );
update_option( 'blogdescription', 'Small homes, carefully made' );
update_option( 'permalink_structure', '/%postname%/' );
function ev_image( $title, $w, $h, $rgb ) {
	$im = imagecreatetruecolor( $w, $h );
	imagefill( $im, 0, 0, imagecolorallocate( $im, $rgb[0], $rgb[1], $rgb[2] ) );
	for ( $i = 0; $i < 6; $i++ ) { imagefilledrectangle( $im, (int) ( $w * $i / 6 ), (int) ( $h * ( 0.55 + 0.06 * ( $i % 3 ) ) ), (int) ( $w * ( $i + 1 ) / 6 ) - 8, $h, imagecolorallocate( $im, max( 0, $rgb[0] - 30 - 8 * $i ), max( 0, $rgb[1] - 30 - 6 * $i ), max( 0, $rgb[2] - 25 ) ) ); }
	$up   = wp_upload_dir();
	$file = $up['path'] . '/' . sanitize_title( $title ) . '.jpg';
	imagejpeg( $im, $file, 82 );
	$id = wp_insert_attachment( [ 'post_title' => $title, 'post_mime_type' => 'image/jpeg', 'post_status' => 'inherit' ], $file );
	require_once ABSPATH . 'wp-admin/includes/image.php';
	wp_update_attachment_metadata( $id, wp_generate_attachment_metadata( $id, $file ) );
	update_post_meta( $id, '_wp_attachment_image_alt', $title );
	return $id;
}
$types = [];
foreach ( [ 'New build', 'Renovation', 'Interior', 'Garden room' ] as $t ) { $r = wp_insert_term( $t, 'project_type' ); $types[ $t ] = is_wp_error( $r ) ? get_term_by( 'name', $t, 'project_type' )->term_id : $r['term_id']; }
$projects = [
	[ 'Saltmarsh Cabin', 'New build', 'A two-room larch cabin raised above the tide line.', [ 168, 150, 120 ], 1600, 1067, '2025' ],
	[ 'Quarry Lane Terrace', 'Renovation', 'A narrow terrace opened up with a rear lightwell.', [ 120, 138, 150 ], 1067, 1600, '2025' ],
	[ 'The Net Loft', 'Interior', 'A former fishing store refitted as a one-bed flat.', [ 190, 170, 150 ], 1600, 1067, '2024' ],
	[ 'Orchard Studio', 'Garden room', 'A writing room among old apple trees.', [ 140, 160, 120 ], 1600, 1200, '2024' ],
	[ 'Fen House', 'New build', 'A long, low family house on reclaimed farmland.', [ 150, 150, 135 ], 1600, 900, '2024' ],
	[ 'Chapel Row', 'Renovation', 'Two cottages joined around a shared kitchen.', [ 175, 140, 125 ], 1200, 1600, '2023' ],
	[ 'Tide Mill Kitchen', 'Interior', 'An oak and limewash kitchen for a listed mill.', [ 200, 185, 160 ], 1600, 1067, '2023' ],
	[ 'Pilot House', 'New build', 'A compact upside-down house facing the estuary.', [ 110, 130, 140 ], 1600, 1067, '2022' ],
	[ 'Bracken Annexe', 'Garden room', 'A guest annexe clad in charred timber.', [ 90, 100, 95 ], 1067, 1600, '2022' ],
];
$out = [ 'projects' => [], 'posts' => [], 'images' => [] ];
foreach ( $projects as $i => $p ) {
	$id = wp_insert_post( [ 'post_type' => 'project', 'post_title' => $p[0], 'post_excerpt' => $p[2], 'post_content' => $p[2] . ' The brief asked for calm rooms, low running costs and materials that weather well.', 'post_status' => 'publish', 'post_date' => sprintf( '%s-0%d-12 09:00:00', $p[6], 1 + ( $i % 8 ) ) ] );
	wp_set_object_terms( $id, [ $types[ $p[1] ] ], 'project_type' );
	$img = ev_image( $p[0], $p[4], $p[5], $p[3] );
	set_post_thumbnail( $id, $img );
	update_post_meta( $id, 'project_year', $p[6] );
	update_post_meta( $id, 'project_location', [ 'Blakeney', 'Norwich', 'Wells', 'Holt', 'Ely', 'Cley', 'Burnham', 'Brancaster', 'Sheringham' ][ $i ] );
	$out['projects'][ $p[0] ] = $id; $out['images'][ $p[0] ] = $img;
}
$cat = wp_insert_term( 'Journal', 'category' ); $cat = is_wp_error( $cat ) ? get_cat_ID( 'Journal' ) : $cat['term_id'];
foreach ( [ [ 'Why we build small', 'Smaller homes are cheaper to heat and easier to love.' ], [ 'Larch, three winters on', 'How untreated cladding has weathered on the coast.' ], [ 'Planning in a conservation area', 'What we have learned from six applications.' ], [ 'A kitchen without wall cupboards', 'Open shelves, deep drawers and one tall larder.' ], [ 'Site diary: Fen House', 'Foundations, frame and the week the roof went on.' ] ] as $i => $j ) {
	$out['posts'][] = wp_insert_post( [ 'post_type' => 'post', 'post_title' => $j[0], 'post_excerpt' => $j[1], 'post_content' => $j[1] . ' Notes from the studio.', 'post_status' => 'publish', 'post_category' => [ $cat ], 'post_date' => sprintf( '2026-0%d-03 10:00:00', 4 + $i ) ] );
}
foreach ( [ 'Portrait Mara', 'Portrait Jonas', 'Portrait Ines', 'Studio interior' ] as $i => $n ) { $out['images'][ $n ] = ev_image( $n, 1200, 1400, [ 150 + 12 * $i, 140, 130 - 8 * $i ] ); }
flush_rewrite_rules();
echo wp_json_encode( $out );
