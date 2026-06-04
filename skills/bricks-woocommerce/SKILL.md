---
name: bricks-woocommerce
description: "Use when setting up, building, or debugging Bricks WooCommerce sites: \"set up Woo pages\", \"build a product archive\", \"customize the cart page\", \"make a Woo product dynamic data tag work\", \"override WooCommerce templates\". Covers Woo setup abilities, registered Woo element classes, product/cart/checkout/account surfaces, template overrides, and the `{post_type:product}` vs default Posts-loop difference."
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

# Bricks: WooCommerce

Current Bricks source exposes **91 WooCommerce/product element schemas** when the experimental advanced modular elements setting is enabled. Classic/default Woo surfaces remain available, and advanced modular cart/checkout/account elements are opt-in through the Bricks global setting `woocommerceUseAdvancedModularElements`.

Most Woo elements wrap WooCommerce's own template functions. Bricks customization is partly about knowing when to use a Bricks element, when to use a Woo template type, and when a Woo hook/template override is the better tool.

## Setup-first workflow

For store setup, use the Woo setup abilities before writing raw element JSON:

1. Call `bricks/get-woo-setup-status`.
2. Call `bricks/plan-woo-setup` with the intended `areas`, `scope`, and `mode`.
3. Review the plan for setting changes, page creation/reuse, and destructive actions.
4. Call `bricks/run-woo-setup`, passing the returned `planId` when available.
5. Fetch exact schemas before custom element edits, then style with existing global classes/theme styles.

Use WooCommerce-owned abilities for product and order operations when they are available. Bricks Woo setup abilities configure Bricks pages, templates, presets, modular Woo elements, and setup-related Woo options.

Default to `mode: "classic"` unless the user explicitly wants the experimental modular v2 flow. Use `mode: "advanced"` only after explaining that it enables an experimental Bricks Woo setting that changes which Woo elements are registered and may affect existing classic Woo setups.

Important setup behavior:

- Missing Woo pages can be created and assigned.
- If a matching unassigned page already exists, reuse it only when it has no Bricks data and is empty or shortcode-only.
- Do not silently overwrite non-empty, block-based, or Bricks-built pages. Destructive page writes require explicit confirmation and `overwriteExistingPageContent`.
- For cart/checkout/account presets, setup can enable required Bricks Woo element gates such as notices, checkout coupon, and checkout login.
- Woo setup options can be read and changed through `bricks/get-woo-setup-options`, `bricks/set-woo-setup-options`, and the global settings abilities.
- When changing Woo page assignments directly, use existing page IDs or `0` to intentionally clear an assignment.

## Classic setup (default)

Classic setup is the release-safe default:

- `shop`: use the Woo shop/archive template flow and classic shop/archive elements.
- `single_product`: use Woo single product template flow and product elements.
- `cart`: use the assigned Woo cart page plus classic cart elements.
- `checkout`: use the assigned Woo checkout page plus classic checkout elements.
- `my_account`: use the assigned Woo account page plus classic account elements.

After setup, customize by fetching exact schemas for the elements already inserted. Prefer preserving the generated Woo structure and changing spacing, typography, layout wrappers, and global classes over replacing the entire tree.

## Advanced modular setup (experimental)

Advanced modular setup is for users who need finer control over cart, checkout, and account states. Enable it only with user confirmation:

- Parent elements: `woocommerce-cart-v2`, `woocommerce-checkout-v2`, `woocommerce-account-page-v2`.
- Cart state children: `woocommerce-cart-v2-state-cart`, `woocommerce-cart-v2-state-empty`.
- Checkout state children: `woocommerce-checkout-v2-state-checkout`, `woocommerce-checkout-v2-state-login`, `woocommerce-checkout-v2-state-pay`, `woocommerce-checkout-v2-state-receipt`, `woocommerce-checkout-v2-state-thankyou`.
- Account state children include dashboard, orders, view order, downloads, addresses, edit address, edit account, payment methods, add payment method, login, lost password, lost password confirmation, and reset password states.
- Support elements include `woocommerce-dynamic-fragment`, `woocommerce-form-field`, `woocommerce-form-submit`, cart quantity/form, checkout billing/shipping/order/payment pieces, and account form pieces.

Treat v2 state elements as generated/managed structural children. Do not create, delete, or move them casually. If the user asks to deeply customize v2 flows, fetch the parent and child schemas first and preserve required state wrappers.

## Migrating classic to advanced

For an existing classic Woo setup:

1. Read setup status and Woo setup options first.
2. Plan advanced setup for only the requested areas.
3. Explain that advanced modular elements are experimental and ask before enabling `woocommerceUseAdvancedModularElements`.
4. Preserve existing page content unless the user explicitly confirms replacement.
5. Run setup, then restyle using the site's existing design system.

Old classic templates may remain after migration. Do not delete old templates or pages unless the user asks; trash/revisions make recovery possible, but unexpected cleanup is still a data-loss risk.

## Product and shop elements

Product-singular elements include title, price, gallery, reviews, rating, meta, content, short description, stock, tabs, related products, upsells, additional information, and add to cart. Build a custom single-product template by composing these in a WooCommerce single-product template (`wc_product`) when you want the Woo template flow.

Shop/archive elements include `woocommerce-products`, products pagination, orderby, filter, total results, archive description, breadcrumbs, and notices. The Woo products-filter wraps native Woo filtering and is separate from generic Bricks query filters.

`woocommerce-template-hook` may exist in the schema set, but only use it when the runtime registers it on the target site.

## Products via standard Posts loop

Products are a custom post type (`product`). You can use a **regular Bricks Posts loop** with `post_type: product`: no Woo element required. This gives you full control over the card layout.

Tradeoff:
- Posts-loop: full Bricks control, no Woo-specific dynamic tags without effort. Use `{woo_product_price}`, `{woo_product_stock}` etc. inside the loop: they'll resolve.
- `woocommerce-products` element: inherits Woo shop queries (sort, filters, pagination) automatically. Less customizable but matches Woo conventions.

**Rule of thumb:** if the user wants "our shop, styled our way" -> Posts loop of products with custom card design. If they want "Woo's standard shop with our header/footer" -> `woocommerce-products` element.

## Woo-specific dynamic data tags

From `provider-woo.php`. Available when current post is a product:

```
{woo_product_type}           -> simple / variable / grouped / external
{woo_product_price}          -> "$29.99" (with currency)
{woo_product_price:value}    -> "29.99" (numeric value)
{woo_product_regular_price}  -> regular price
{woo_product_sale_price}     -> sale price (empty if not on sale)
{woo_product_excerpt}        -> product short description
{woo_product_stock}          -> stock status / quantity
{woo_product_sku}
{woo_product_gtin}
{woo_product_rating}
{woo_product_on_sale}
{woo_product_badge_new}
{woo_add_to_cart}
```

**Outside product context:** these resolve empty. To render a specific product, place the tag inside a product loop or preview it through MCP with the target product `postId`.

## Cart & checkout: two flows

Two separate pages (`/cart/` and `/checkout/`), each with its own Bricks template option. Approach:

### Option 1: Bricks elements compose the Woo page
- Use the WooCommerce cart or checkout template type when available in Bricks; Woo template types are routed to their Woo page automatically.
- Compose cart elements: `cart-items` + `cart-collaterals`.
- If you are using a normal `content` template instead, scope it with `ids` to the configured Woo cart or checkout page. There is no `pageType: cart` condition in the Bricks template condition schema.

### Option 2: Standard Woo page with Bricks header/footer only
- Don't create a content template for cart/checkout.
- Woo's default templates render; Bricks only owns header/footer.
- Simpler but less flexible.

## WooCommerce template overrides

Woo's templating allows overriding individual template parts. Bricks doesn't interfere: if you place overrides in your child theme's `woocommerce/` directory, Woo uses them normally.

**Theme hierarchy for Woo templates:**
1. Your-theme/woocommerce/{template}.php
2. Parent-theme (bricks)/woocommerce/{template}.php
3. Woo-plugin-default/{template}.php

Bricks does include WooCommerce template files under its theme `woocommerce/` directory. A child theme override still wins because Woo checks the child theme before the parent theme.

**When to override vs. use Bricks elements:**
- Override Woo templates: you need to change the logic of a Woo surface (add a meta field to the order email, restructure the cart-item row HTML with custom attributes the element can't emit).
- Use Bricks elements: you need to restyle/relayout. Styling is Bricks' job.

## Key Woo hooks

| Hook | Kind | Purpose |
|---|---|---|
| `bricks/woocommerce/products_filters/options` | filter | Options for the Woo products-filter element |
| `woocommerce_loop_add_to_cart_link` | filter | Add-to-cart button HTML |
| `woocommerce_loop_product_title` | filter | Product card title HTML |
| `woocommerce_before_shop_loop` / `after_shop_loop` | action | Around shop loop |
| `woocommerce_single_product_summary` | action | Single product summary content |
| `woocommerce_cart_calculate_fees` | action | Add fees at checkout |

(Most hooks above are Woo's, not Bricks'. Check Woo's docs for the exhaustive list.)

From Bricks side, `includes/woocommerce.php` registers the integration at plugin load.

## Theme style for Woo

Bricks registers WooCommerce theme style controls for Woo buttons and Woo notices. Use existing global classes, variables, palettes, and theme styles first. If the site has a design system, match it. If the site is still stock, create only a clean functional setup unless the user also asks for styling or a new design system.

## Variations, attributes, and the variable-product gotcha

Variable products have sub-configurations (size, color). The single-product add-to-cart element handles the `<select>` UI by default.

**Gotcha:** if you build a custom product card on archive pages and link straight to `?add-to-cart=PRODUCT_ID`, you bypass the variation selector. User lands on cart with "which variant?" failure. Always let the user choose variants before adding to cart.

## Mini-cart, cart drawer, offcanvas cart

`woocommerce-mini-cart.php` is a Bricks Woo element. Use it when you want the built-in mini cart output. For a custom drawer, build with Bricks Offcanvas plus Woo cart elements, toggled by an interaction on a cart button in the header.

For a custom cart-count badge, use a wrapped PHP function around `WC()->cart->get_cart_contents_count()` through an allowed `{echo:...}` path (see `bricks-custom-code` skill). Do not invent a `{woo_cart_count}` tag unless the current source registers it.

## My Account: composed pages

Account pages are Woo's multi-tab interface. Elements for each tab are separate:
- `woocommerce-account-dashboard.php` (not available as a separate Bricks element; default Woo)
- `woocommerce-account-orders.php`, `-addresses.php`, `-downloads.php`, `-payment-methods.php`, `-view-order.php`, `-edit-account.php`, `-edit-address.php`
- Login/registration: `-form-login.php`, `-form-register.php`
- Password: `-form-lost-password.php`, `-form-reset-password.php`

To customize account surfaces, use the dedicated Woo account elements or a Bricks Woo account template flow. The normal template condition schema does not include URL-pattern or `isEndpoint` condition kinds.

## Performance on Woo sites

Woo sites are notoriously heavy. Bricks' performance tuning (see `bricks-performance` skill) applies, plus:

- **CSS loading mode** = `file`: on Woo, inline CSS can balloon (product-specific styles per variant). File mode caches.
- **Product archives** with 100+ products per page: use query cache (if available) and paginate tighter (24 per page, not 48+).
- **Mini-cart AJAX refresh**: Woo's default `added_to_cart` fragment refresh is JS-heavy. On complex sites, consider a lighter custom endpoint.

## Silent-failure debug order

1. **Woo element renders placeholder text in builder, empty on frontend?**
   a. Current page isn't a product/archive/cart context. Element only works in its intended context.
   b. Test on an actual product single page, not the builder preview root.

2. **Add-to-cart button does nothing?**
   a. Product is out of stock but "Continue selling when out of stock" is off.
   b. Variable product without selected variation.
   c. JS error elsewhere preventing Woo scripts from initializing.
   d. CAPTCHA / Cloudflare interceptor blocking the AJAX call.

3. **Cart shows empty after adding?**
   a. Session cookie blocked (cookies-disabled on the browser, or test-mode without proper session handling).
   b. Cart fragments AJAX failing. Check Network tab for `wc-ajax=get_refreshed_fragments`.

4. **Checkout validation fires but form doesn't submit?**
   a. Custom JS on the page hijacking the submit event.
   b. Payment gateway misconfiguration: check Woo > Settings > Payments.

5. **Woo dynamic tag `{woo_product_price}` renders empty?**
   a. Not in a product context. Move inside a product loop or preview with the target product `postId`.
   b. Product has no price set (free product without explicit "0.00").

6. **Custom Woo template override ignored?**
   a. File path typo: Woo is strict: `child-theme/woocommerce/single-product/title.php` (mirrors plugin structure exactly).
   b. File-exists check not firing; try with a `cart/cart.php` override first as a sanity test.

## Never do

- Enable advanced modular Woo elements by default on an existing/production store.
- Overwrite assigned Woo pages without status, plan review, and explicit user confirmation.
- Treat v2 state elements as normal standalone elements; they are structural children of their v2 parent.
- Build a shop with a regular Posts loop **and** the `woocommerce-products` element on the same template: you'll double-render products.
- Put Woo elements outside their expected context (cart element on a product page): they'll render errors or empty.
- Bypass Woo's variation selector by building a direct-add-to-cart link on variable products.
- Skip the Woo theme style: it's there specifically for consistent button/badge/card styling across your Woo surfaces.
- Override a Woo template when a Bricks element would reshape it. Template overrides are harder to audit than Bricks-native.
- Cache product pages aggressively without excluding cart and checkout: you'll serve stale cart state.
