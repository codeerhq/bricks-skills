---
name: bricks-hooks-reference
description: "Use when you need to find the right Bricks hook: \"what filter modifies a query?\", \"how do I intercept render?\", \"is there a hook for form submit?\". Curated index of Bricks actions/filters grouped by purpose, with file:line citations and return-value + priority traps."
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

# Bricks: hooks reference

Bricks ships many `bricks/*` hooks across the theme. Do not guess hook names. This is a curated index. Names here are verified against the `/includes/` tree: if a hook appears here, it exists.

To confirm any hook and see its context in the current version, grep the source:

```bash
rg -n "apply_filters\(\s*['\"]bricks/hook_name_here" includes/
rg -n "do_action\(\s*['\"]bricks/hook_name_here" includes/
```

## The three rules that trip up every callback

1. **Filters must return**: forgetting `return $value` in a filter callback makes the value `null` for every downstream consumer. `bricks/element/render_attributes` is the most common foot-gun.
2. **Priority 10 is Bricks' floor**: Bricks hooks many of its own callbacks at default priority 10. If you're **mutating** (not just observing), use **20+**. If you're routing around Bricks' own logic, use **1**.
3. **Scope by `element_id` or post ID**: most render/query hooks pass a context object (`$query`, `$element`, `$post`). Always branch on `$query->element_id` / `$element->id` inside the callback to avoid mutating every loop/element on the page.

## Query hooks: modify what a loop fetches

Queries are the highest-volume extension point. Reach for hooks before "Custom Query (PHP)" in the UI: hooks don't require the `bricks_execute_code` capability and live in version control.

| Hook | Kind | Fires | Purpose |
|---|---|---|---|
| `bricks/posts/query_vars` | filter | Before `WP_Query` runs on a Posts loop | Mutate query args (meta_query, tax_query, orderby) |
| `bricks/terms/query_vars` | filter | Before `WP_Term_Query` | Same, for Terms loops |
| `bricks/users/query_vars` | filter | Before `WP_User_Query` | Same, for Users loops |
| `bricks/query/run` | filter | Before any loop executes | Return an array to short-circuit with custom items |
| `bricks/query/run_fake` | filter | Builder preview only | Provide fake data in the builder |
| `bricks/query/result` | filter | After fetch, pre-render | Mutate the result array |
| `bricks/query/result_count` | filter | After fetch | Override total count (pagination reads this) |
| `bricks/query/result_max_num_pages` | filter | After fetch | Override max pages |
| `bricks/query/result_start` / `result_end` | filter | Around the loop | Wrappers for markup before/after |
| `bricks/query/loop_object` | filter | Every iteration | Swap the current object |
| `bricks/query/loop_object_id` | filter | Every iteration | Swap just the id |
| `bricks/query/loop_object_type` | filter | Every iteration | Swap the type (post/term/user) |
| `bricks/query/before_loop` / `after_loop` | action | Once per loop | Enqueue assets, etc. |
| `bricks/query/init_loop_index` | filter | Start of loop | Override starting index |
| `bricks/query/force_loop_index` | filter | Per iteration | Override current index |
| `bricks/query/no_results_content` | filter | Empty result set | Custom "no results" HTML |
| `bricks/query/cache_key` | filter | Cache lookup | Customize cache key shape |
| `bricks/query/fake_result` | filter | Builder | Fake data shape |
| `bricks/query/force_is_looping` / `force_run` | filter | Guard | Force loop context on/off |
| `bricks/query/supress_render_content` | filter | Render | Skip inner render |
| `bricks/query/prepare_query_vars_from_settings` | filter | Settings -> args | Intercept the translation step |
| `bricks/query/query_api_response` | action | Query API | Mutate API-mode result |
| `bricks/query_api/total_pages` | filter | Query API | Override pagination count |
| `bricks/posts/merge_query` | filter | Archive / search | Control auto-merge of main query |
| `bricks/related_posts/query_vars` | filter | Related-posts element | Args for related query |
| `bricks/helpers/get_posts_args` | filter | Internal helper | Args for `Helpers::get_posts()` |
| `bricks/ajax/get_pages_args` | filter | Pagination AJAX | Args during AJAX page fetch |
| `bricks/render_query_page/start` | action | Page render | Fires at start of a paginated page |
| `bricks/render_query_loop_trail` | filter | Loop end | Trailing loop output filter |
| `bricks/render_query_result/start` | action | Result render | Start marker |
| `bricks/get_element_data/maybe_from_post_id` | filter | Builder | Whether to pull element data from a specific post |

Most query lifecycle hooks pass the `$query` object, and `$query->element_id` scopes logic to one loop. Object-specific `posts/terms/users/query_vars` filters pass query vars plus settings, element id, and element name. Check the hook signature before writing the callback.

## Render hooks: modify output

| Hook | Kind | Purpose |
|---|---|---|
| `bricks/element/render` | filter | Wrap/replace a single element's HTML |
| `bricks/element/render_attributes` | filter | Mutate attributes on an element: most common wrapper hook |
| `bricks/element/set_root_attributes` | filter | Add attributes to root element |
| `bricks/element/settings` | filter | Mutate an element's resolved settings before render |
| `bricks/element/builder_setup_query` | filter | Builder preview query setup |
| `bricks/element/maybe_set_aria_current_page` | filter | A11y current-page marker |
| `bricks/frontend/render_data` | filter | Root `_bricks_page_content_2` data before render |
| `bricks/frontend/render_element` | filter | Just-in-time per-element render |
| `bricks/frontend/render_loop` | filter | Loop-level render |
| `bricks/frontend/before_render_data` / `after_render_data` | action | Wrap the whole page render |
| `bricks/frontend/disable_opengraph` / `disable_seo` | filter | Opt out of Bricks' OG / SEO |
| `bricks/render_header` / `render_footer` | filter | Theme header/footer render |
| `bricks/render_popup_content/start` | action | Start of popup render |
| `bricks/render_with_bricks` | filter | Whether a post renders with Bricks at all |
| `bricks/content/tag` | filter | Wrapper tag for main content |
| `bricks/content/attributes` | filter | Attributes on main content wrapper |
| `bricks/content/html_after_begin` / `html_before_end` | filter | Inject HTML at content boundaries |
| `bricks/header/attributes` / `footer/attributes` | filter | Attributes on theme header/footer |
| `bricks/body/attributes` | filter | Attributes on `<body>` |
| `bricks/popup/attributes` | filter | Attributes on a popup root |
| `bricks/nav_menu/menu` | filter | Nav menu markup |

Defined across `includes/frontend.php`, `includes/element.php`, `includes/elements/*.php`.

## Builder hooks: UI-only

These run inside the Bricks builder (not on the public frontend). Don't wire site logic here.

| Hook | Purpose |
|---|---|
| `bricks/builder/elements` | Register elements in the builder element panel |
| `bricks/builder/color_palette` | Default color palette shown to new sites |
| `bricks/builder/i18n` | Translate builder UI strings |
| `bricks/builder/map_styles` | Google Maps styles dropdown |
| `bricks/builder/image_size_options` | Image size dropdown options |
| `bricks/builder/codemirror_config` | CodeMirror editor config |
| `bricks/builder/supported_post_types` | Which CPTs the builder opens on |
| `bricks/builder/standard_fonts` | Standard-fonts dropdown |
| `bricks/builder/current_page_type` | Current page-type label |
| `bricks/builder/data_post_id` | Post ID used for preview data |
| `bricks/builder/dynamic_wrapper` | Whether to wrap dynamic content |
| `bricks/builder/first_element_category` | Default category in element panel |
| `bricks/builder/post_title` / `term_name` | Preview title / term name |
| `bricks/builder/save_messages` | Custom messages on save |
| `bricks/builder/switch_locale` | Switch builder locale |
| `bricks/load_elements/before` / `after` | Register custom elements |
| `bricks/support_masonry_element` | Whether masonry is supported |
| `bricks/setup/control_options` | Customize control options |
| `bricks/link_css_selectors` | CSS selector suggestions in link control |
| `bricks/is_layout_element` | Whether an element is a layout element |
| `bricks/conditions/groups` / `options` / `result` | Conditions system in builder |
| `bricks/dynamic_tags_list` | Dropdown of dynamic tags |

## Form hooks

| Hook | Kind | Purpose |
|---|---|---|
| `bricks/form/validate` | filter | Return errors array to block submission |
| `bricks/form/response` | filter | Final JSON response sent to client |
| `bricks/form/action/{action}` | action | Register a custom action handler for your own action key |
| `bricks/form/custom_action` | action | Hook fired by the built-in `custom` form action class |
| `bricks/form/recaptcha_score_threshold` | filter | reCAPTCHA v3 score threshold (default 0.5) |
| `bricks/form/file_directory` | filter | Upload directory for file fields |
| `bricks/form/tinymce_settings` | filter | TinyMCE config for richtext fields |
| `bricks/form/save-submission/form_data` | filter | Sanitize form data before DB write |
| `bricks/form/submission-table/file_url` | filter | URL for files in the admin submissions table |
| `bricks/form/create_post/meta_value` | filter | Meta value when form creates a post |
| `bricks/form/update_post/meta_value` | filter | Meta value when form updates a post |
| `bricks/element/form/honeypot/result` | filter | Honeypot check result |
| `bricks/element/form/datepicker_options` | filter | Datepicker field config |

Defined in `includes/integrations/form/init.php` and `includes/integrations/form/actions/*.php`.

Register a custom action: hook `bricks/form/action/my_action` with a callback that receives the form instance. Add `my_action` to the form's action list in the builder. For the built-in `custom` action, hook `bricks/form/custom_action` instead. Use the form getters: `get_fields()`, `get_settings()`, `get_uploaded_files()`, `get_id()`, `get_post_id()`, and `set_result()`.

## Dynamic data hooks

| Hook | Purpose |
|---|---|
| `bricks/dynamic_data/register_providers` | Filter the built-in provider slug list before Bricks registers providers |
| `bricks/dynamic_data/register_hook` | Change the WP hook Bricks uses to register built-in providers and tags |
| `bricks/dynamic_data/render_tag` | Render a single tag: early filter, use to short-circuit |
| `bricks/dynamic_data/render_content` | Render full content with all tags parsed |
| `bricks/dynamic_data/tag_value_parsed` | Action fired after a single tag value is parsed |
| `bricks/dynamic_data/format_value` | Apply formatting modifier to a value |
| `bricks/dynamic_data/tags_registered` | All tags, post-registration |
| `bricks/dynamic_data/allowed_keys` | Parser keys allowed after `@`, such as `fallback`, `sanitize`, `key`, `date`, `from`, and `to` |
| `bricks/dynamic_data/exclude_tags` | Tags excluded from a render context |
| `bricks/dynamic_data/author_value` / `user_value` | Value for `{author_*}` / `{user_*}` |
| `bricks/dynamic_data/post_terms_links` / `post_terms_separator` / `text_separator` | Term-list rendering |
| `bricks/dynamic_data/read_more` | "Read more" link modification |
| `bricks/dynamic_data/replace_nonexistent_tags` | Whether to replace tags with no provider |
| `bricks/dynamic_data/before_do_action` / `after_do_action` | Around action-modifier tags |

Defined in `includes/integrations/dynamic-data/*`.

## Code + security hooks (audit-sensitive)

| Hook | Kind | Purpose |
|---|---|---|
| `bricks/code/echo_function_names` | filter | **Required**: echo-tag allow-list. Return array of function names or `@regex` patterns. Never return `true` in production. |
| `bricks/code/echo_everywhere` | filter | Opt-in: echo tags in non-text fields (URLs, style values). Default false; opens attack surface. |
| `bricks/code/allow_execution` | filter | Per-user / per-post override of code-execution gate |
| `bricks/code/disable_execution` | filter | Global kill-switch for code execution |
| `bricks/code/disallow_keywords` | filter | Keyword blocklist for PHP validators |
| `bricks/security_check_before_save/new_elements` | filter | Pre-save validation of incoming elements tree |
| `bricks/allowed_html_tags` | filter | Global HTML tag allow-list |
| `bricks/svg/bypass_sanitization` | filter | Skip SVG sanitizer (dangerous) |
| `bricks/svg/allowed_tags` / `svg/allowed_attributes` | filter | SVG allow-list |
| `bricks/custom_fonts/mime_types` | filter | Accepted font MIME types |

**Never** `return true` on `bricks/code/echo_function_names` in production: that's the pre-1.9.7 RCE surface. See the `bricks-custom-code` skill for the full echo-tag threat model.

## Query-filter hooks

Filter elements (filter-checkbox / radio / select / range / search / datepicker) have their own pipeline.

| Hook | Purpose |
|---|---|
| `bricks/filter_element/controls` | Mutate filter element controls in builder |
| `bricks/filter_element/filtered_source` | Filtered data-source output |
| `bricks/filter_element/populated_options` | Filter options after population |
| `bricks/filter_element/data_source_{source}` | Register custom source: `{source}` is your key |
| `bricks/filter_element/count_source_{source}` | Custom count for a source |
| `bricks/filter_element/before_set_data_source_from_custom_field` | Pre-hook for custom-field sources |
| `bricks/filter/taxonomy_args` | Taxonomy query args for taxonomy-source filters |
| `bricks/filter_element/datepicker_db_date_format` | DB-side date format |
| `bricks/filter-element/datepicker_options` | Datepicker field UI options |
| `bricks/query_filters/custom_field_meta_query` | Meta query for custom-field filters |
| `bricks/query_filters/range_custom_field_meta_query` | Same for range filters |
| `bricks/query_filters/datepicker_custom_field_meta_query` | Same for datepicker |
| `bricks/query_filters/custom_field_index_rows` | Rows indexed per post for custom fields |
| `bricks/query_filters/element_data` | Element data passed to frontend |
| `bricks/query_filters/get_filter_object_ids` | Object IDs returned by a filter |
| `bricks/query_filters/index_args` | Args for the filter indexer |
| `bricks/query_filters/index_post/before` / `index_user/before` | Before-index hooks |
| `bricks/query_filters/index_post/meta_exists` / `index_user/meta_exists` | Meta-existence check |
| `bricks/query_filters_indexer/post/*` | Indexer internals |
| `bricks/query_filters_indexer/validate_job_settings` | Validate indexer job |
| `bricks/fix_filter_element_db` | DB-migration utility hook |

Defined in `includes/query-filters.php`, `includes/elements/filter-*.php`.

## Template hooks

| Hook | Purpose |
|---|---|
| `bricks/get_templates` | Return list of available templates |
| `bricks/get_templates/query_vars` | Template query args |
| `bricks/get_templates_query/cache_key` | Cache key shape |
| `bricks/get_template_authors` | Template authors list |
| `bricks/get_template_bundles` | Template bundles list |
| `bricks/get_template_tags` | Template tags list |
| `bricks/get_remote_templates_data` | Remote template-library data |
| `bricks/active_templates` | Which templates are active on the current page |
| `bricks/template_preview/supported_content_types` | Preview content types |
| `bricks/database/bricks_get_all_templates_by_type_args` | DB query args |
| `bricks/database/content_type` | Content type for a template |
| `bricks/database/get_all_templates_cache_key` | Cache key |
| `bricks/api/get_templates_data` | REST API template data |
| `bricks/use_duplicate_content` | Whether to use duplicate-content rules |

Defined in `includes/database.php`, `includes/templates.php`.

## Integration hooks (WooCommerce, ACF, plugins)

| Hook | Purpose |
|---|---|
| `bricks/woocommerce/products_filters/options` | Woo product-filters element options |
| `bricks/acf/filter_field_groups` | ACF field-groups filtering |
| `bricks/acf/google_map/address_parts` / `show_as_address` / `text_output` | ACF map field rendering |
| `bricks/acf/taxonomy/show_as_link` | ACF taxonomy field rendering |
| `bricks/cmb2/checkbox_value` | CMB2 checkbox value format |
| `bricks/metabox/checkbox_value` / `show_as_map` / `taxonomy/show_as_link` | Meta Box field rendering |
| `bricks/polylang/builder_ajax_params` | Polylang-specific AJAX params |

## Pagination, search, breadcrumbs, menus

| Hook | Purpose |
|---|---|
| `bricks/pagination/current_page` | Override current page number |
| `bricks/pagination/total_pages` | Override total pages |
| `bricks/pagination/custom_logic` | Custom pagination logic |
| `bricks/paginate_links_args` | Args for `paginate_links()` wrapper |
| `bricks/combined_search/post_ids` / `term_ids` / `user_ids` | Combined-search result IDs |
| `bricks/breadcrumbs/items` / `separator` / `home_label` | Breadcrumbs element |
| `bricks/nav_menu/menu` | Nav menu HTML |
| `bricks/comments/author_tag` / `timestamp` | Comments element |

## Auth, password protection

| Hook | Purpose |
|---|---|
| `bricks/auth/custom_login_redirect` | Post-login redirect URL |
| `bricks/auth/custom_registration_redirect` | Post-registration redirect |
| `bricks/auth/custom_lost_password_redirect` | Post-lost-password redirect |
| `bricks/auth/custom_reset_password_redirect` | Post-reset-password redirect |
| `bricks/auth/custom_redirect_url` | Generic redirect URL |
| `bricks/user_activation_email/subject` / `from_name` / `content` | Activation email |
| `bricks/password_protection/cookie_expires` | Cookie TTL |
| `bricks/password_protection/is_active` | Whether password protection is active |

## Assets, CSS, styles

| Hook | Purpose |
|---|---|
| `bricks/assets/generate_css_from_element` | Generate CSS from an element's settings |
| `bricks/assets/load_webfonts` | Whether to load webfonts |
| `bricks/generate_css_file` | CSS file generation |
| `bricks/theme_styles` | Theme styles registry |
| `bricks/theme_styles/controls` / `control_groups` | Theme style controls |
| `bricks/theme_style_name` | Theme style display name |

## Misc: often-needed

| Hook | Purpose |
|---|---|
| `bricks/placeholder_image` | Placeholder image URL (builder previews) |
| `bricks/get_the_title` | `get_the_title()` wrapper |
| `bricks/remote_get` / `remote_post` | HTTP requests via Bricks helpers |
| `bricks/webhook/timeout` | Webhook request timeout |
| `bricks/rtl_languages` | RTL language list |
| `bricks/screen_conditions/scores` | Screen size condition scoring |
| `bricks/handle_no_results_children_elements` | No-results child handling |
| `bricks/get_terms_options/enable_limit` | Enable limit on terms dropdown |
| `bricks/get_builder_edit_link` | Builder edit link URL |

## Never do

- Trust the hook name without grepping. Bricks renames occasionally (e.g. `filter-element` vs `filter_element`).
- Hook into a builder hook (`bricks/builder/*`) expecting it to fire on the frontend. Different contexts.
- Mutate inside a filter and forget to return: silent null propagation downstream.
- Register your callback at priority 10 when Bricks also hooks at priority 10: non-deterministic ordering.
- Modify `bricks/posts/query_vars` without scoping to `$query->element_id`: you'll mutate every Posts loop on every page.
