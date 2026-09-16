---
name: bricks-mega-menus
description: "Create or edit Bricks navigation: WordPress menus, nested navigation and mega panels. Use the ordinary-menu path when no mega menu is needed."
---

# Bricks: mega menus

Preserve the site's navigation model. Ordinary menu edits do not require a mega
panel or a new header. Pick the existing-menu or native-element path before writing.

## Ordinary WordPress menu edits

Use `list-nav-menus` and `get-nav-menu` to resolve the current menu and item IDs.
Use `save-nav-menu` for the requested labels, links, hierarchy/order and locations,
preserving unrelated fields and Bricks item metadata. Omitted items are retained,
not deleted; removals need explicit item IDs through `delete-nav-menu-items`.
Do not create a section template or enable mega-menu settings for an ordinary link
change. Read back the affected tree and check the rendered header when possible.

## Default decision

For a new header without an established menu model, **Nav Nested + Dropdown** is a useful native option. It is fully Bricks-native: the menu, dropdown panel, layout, styles, and mobile behavior live in the header template element tree, so normal element abilities can create and edit everything.

Use **WordPress Nav Menu + Bricks section template** only when:

- The user explicitly asks for menus managed in Appearance > Menus.
- The site already has meaningful WordPress menus that should be preserved.
- Non-builder users need to edit menu labels/order/links from the WordPress dashboard.

## New Bricks-native mega menu

Author this inside the active header template. Load **bricks-headers-footers** first if you have not already identified the header template and area.

Safe shape:

```text
header template
`-- section
    `-- nav-nested
        |-- text-link
        |-- dropdown (settings.megaMenu = true)
        |   `-- div/block/container with _hidden._cssClasses = brx-dropdown-content
        |       `-- rich mega menu content: grids, columns, headings, images, buttons, nav links
        `-- toggle / close controls as needed for mobile
```

Important settings:

- On the `dropdown` element, set `megaMenu: true`.
- Use `megaMenuSelector` when the panel should match a specific wrapper width and horizontal position, such as a custom header inner wrapper. If omitted, Bricks uses the document body width.
- Use `megaMenuSelectorVertical` only when the vertical offset must be calculated from a specific header node.
- Keep `toggleOn` intentional: hover for classic desktop menus, click for touch-friendly or complex panels.
- Style the panel through Dropdown and Nav Nested controls where possible: dropdown background, border, box shadow, width, transform, transition, z-index, item typography, and mobile-menu controls.
- In mega menu mode, dropdown content children are not forced into `<li class="menu-item">` wrappers. Use layout elements freely for columns/cards; add text links where a real menu link is needed.

Mobile behavior:

- Nav Nested mobile controls live on the `nav-nested` parent.
- Mega menu dropdown content becomes static inside the open mobile menu and min-width is reset.
- Check that rich panels still scan well in a narrow drawer; desktop grids often need a simpler mobile column layout.

## Reusing an existing WordPress menu

Use this when the site already has a WordPress menu or the user asks for dashboard-managed menus.

Discovery:

1. `bricks/list-nav-menus` through the dispatcher to see existing menus, locations, and Bricks mega-menu metadata.
2. `bricks/get-nav-menu` for the exact menu tree before editing.
3. `bricks/list-templates` filtered to `section` if you need an existing mega menu template.

If a mega menu template is needed:

1. Create a Bricks template with `bricks/create-template`, `type: "section"`, and `status: "publish"`.
2. Build the panel content with normal element abilities on that section template.
3. Attach it to a top-level WordPress menu item with `bricks/save-nav-menu` using:

```json
{
  "menuId": 123,
  "items": [
    {
      "menuItemId": 456,
      "title": "Services",
      "url": "/services/",
      "bricksOptions": {
        "megaMenuTemplateId": 789
      }
    }
  ]
}
```

Then make sure the header has a `nav-menu` element with:

- `menu` set to the WordPress menu ID.
- `megaMenu: true`.
- `megaMenuSelector` if the panel should match a header wrapper instead of the body.
- `megaMenuToggleOn` set intentionally.

## Editing WordPress menus safely

`bricks/save-nav-menu` can create/rename a menu, assign registered theme locations, create/update/reorder items, and set Bricks item options. It preserves omitted items. WordPress menu edits have no Bricks revisions.

Use explicit destructive abilities for removals:

- `bricks/delete-nav-menu-items` for specific menu item IDs.
- `bricks/delete-nav-menu` for a whole menu.

Before destructive calls, inspect the current `bricks/get-nav-menu` snapshot and
ensure the exact removal is authorized. Ask only if scope or targets are unclear. The delete response returns `beforeDelete`; retain it for
recovery after the operation.

## Verification

Read back first:

- `bricks/get-page-elements` on the header template: confirm the `nav-nested`, `dropdown`, or `nav-menu` settings persisted.
- `bricks/get-nav-menu`: confirm item order, parent IDs, and Bricks `megaMenuTemplateId` / `multilevel` options.
- `bricks/list-revisions` for header/template element writes that returned `revisionId`.

Browser verification should cover:

- Desktop open state, width, and horizontal alignment.
- Hover/click behavior.
- Keyboard focus and escape/outside close.
- Mobile drawer open state and nested panel stacking.
- Links inside the mega panel setting the top-level active/current state.

## Common mistakes

- Building a new header with `nav-menu` only because the word "menu" appears in the request. Prefer `nav-nested` for new work.
- Attaching `megaMenuTemplateId` to a nested WordPress menu item. Bricks mega menus are for top-level menu items.
- Creating the mega panel as a header/footer template. Use a section template for WordPress-menu-backed mega panels.
- Forgetting to enable `megaMenu` on the header `nav-menu` element. The menu item meta alone is not enough.
- Deleting omitted WordPress menu items during a save. Never infer deletion from omission; use the explicit delete ability.
