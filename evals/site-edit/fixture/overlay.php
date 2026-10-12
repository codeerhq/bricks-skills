<?php
// Ages the agent-built fixture the way an owner and earlier sessions would: leftovers, hacks, duplicated details.
wp_set_current_user( 1 );
$append = static function ( $post_id, $parent_of, $text ) {
	$els = get_post_meta( $post_id, BRICKS_DB_PAGE_CONTENT, true );
	foreach ( $els as $i => $e ) {
		if ( $e['id'] === $parent_of ) {
			$parent = $e['parent'];
			$id     = substr( md5( $post_id . $parent_of ), 0, 6 );
			$new    = [ 'id' => $id, 'name' => 'text-basic', 'parent' => $parent, 'children' => [], 'settings' => [ 'text' => $text, '_margin' => [ 'top' => '12px' ], '_typography' => [ 'font-size' => '15px' ] ] ];
			array_splice( $els, $i + 1, 0, [ $new ] );
			foreach ( $els as &$p ) {
				if ( $p['id'] === $parent ) {
					$pos = array_search( $parent_of, $p['children'], true );
					array_splice( $p['children'], $pos + 1, 0, [ $id ] );
				}
			}
			unset( $p );
			break;
		}
	}
	update_post_meta( $post_id, BRICKS_DB_PAGE_CONTENT, wp_slash( $els ) );
};
$home = get_page_by_path( 'home' )->ID; $about = get_page_by_path( 'about' )->ID; $services = get_page_by_path( 'services' )->ID;
$append( $home, '575sbx', 'or write to us at hello@harbourpine.example' );
$append( $about, 'sir6o0', 'Email Mara directly: <a href="mailto:hello@harbourpine.example">hello@harbourpine.example</a>' );
$els = get_post_meta( $services, BRICKS_DB_PAGE_CONTENT, true );
foreach ( $els as &$e ) { if ( $e['id'] === 'yfpcn0' ) { $e['settings']['text'] = str_replace( 'Get in touch by email,', 'Get in touch by email (hello@harbourpine.example),', $e['settings']['text'] ); } }
unset( $e );
update_post_meta( $services, BRICKS_DB_PAGE_CONTENT, wp_slash( $els ) );

$classes = get_option( BRICKS_DB_GLOBAL_CLASSES, [] );
foreach ( [ [ 'paper', [ '_background' => [ 'color' => [ 'hex' => '#f6f1e7' ] ] ] ], [ 'notebook', [ '_cssCustom' => ".notebook {\n  background-image: repeating-linear-gradient(#0000 0 31px, #d9d2c3 31px 32px);\n}" ] ], [ 'Title 2', [ '_typography' => [ 'font-family' => 'Georgia,serif', 'font-size' => '34px', 'font-weight' => '700' ] ] ], [ 'hp-old-hero__title', [ '_typography' => [ 'font-size' => '72px', 'letter-spacing' => '-1px' ] ] ] ] as $i => $c ) {
	$classes[] = [ 'id' => substr( md5( 'legacy' . $i ), 0, 6 ), 'name' => $c[0], 'settings' => $c[1] ];
}
update_option( BRICKS_DB_GLOBAL_CLASSES, $classes );

$settings              = get_option( BRICKS_DB_GLOBAL_SETTINGS, [] );
$settings['customCss'] = "/* quick fixes - do not remove */\n.pcard:hover .pcard-img img { transform: scale(1.03); transition: transform .4s; }\n.pcard-img { overflow: hidden; }\n@media (max-width: 478px) {\n  .section-title { font-size: 2.8rem !important; }\n  .brxe-nav-nested .brx-nav-nested-items { gap: 6px !important; }\n}\n.jcard-title a, .pcard-title a { text-decoration: none; color: inherit; }\nfooter .footer-text a { text-decoration: underline; }\n";
update_option( BRICKS_DB_GLOBAL_SETTINGS, $settings );

$vars = get_option( BRICKS_DB_GLOBAL_VARIABLES, [] );
foreach ( [ [ 'font-heading-old', "'Playfair Display', serif" ], [ 'font-ui', 'Inter, sans-serif' ] ] as $i => $v ) { $vars[] = [ 'id' => substr( md5( 'var' . $i ), 0, 6 ), 'name' => $v[0], 'value' => $v[1] ]; }
update_option( BRICKS_DB_GLOBAL_VARIABLES, $vars );
echo 'ok';
