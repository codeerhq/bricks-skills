---
name: bricks-sidebars
description: "Register, rename, wire or remove Bricks custom WordPress sidebars, including widget-placement consequences."
---

# Bricks: sidebars (via MCP)

Bricks registers its own sidebars (widget areas) on top of theme-provided sidebars. They appear in `Appearance > Widgets` and in the Bricks Sidebar element picker.

Storage: `bricks_sidebars` option, as an ordered array of `{ id, name, description }` rows (`includes/abilities/sidebars.php`).

## Reuse before creating

For “show the existing sidebar,” resolve its ID with `list-sidebars`, then use the
Sidebar element's `settings.sidebar` control. The sidebar-management abilities use
`sidebarId` arguments; that is not the element setting key. Preserve its existing
widget placements. Registering a sidebar does not add widgets; an empty sidebar can
legitimately render empty. Inspect widget assignment through an available WordPress
surface when diagnosing it, and do not recreate the sidebar as a repair shortcut.

## Abilities

- **`bricks/list-sidebars`**: returns `{ sidebars, total }`.
- **`bricks/create-sidebar`**: body `{ name, description? }`. The ID is derived from the name.
- **`bricks/update-sidebar`**: body `{ sidebarId, name?, description? }`. ID is immutable.
- **`bricks/delete-sidebar`**: body `{ sidebarId }`. Deletes the Bricks sidebar row and removes the same key from WP core `sidebars_widgets`.

## ID generation

You do not send an ID on create. Bricks derives it:

1. Lowercase the name.
2. Replace spaces with underscores.
3. Strip every character except `a-z`, `0-9`, and `_`.

Example:

```
bricks/create-sidebar { name: "Shop Sidebar", description: "Product filters" }
  -> { sidebar: { id: "shop_sidebar", name: "Shop Sidebar", description: "Product filters" } }
```

Avoid names that collapse to the same ID, such as `Shop Sidebar` and `Shop Sidebar!`.

## What Bricks does automatically

- Calls `register_sidebar()` for every Bricks sidebar during `widgets_init`.
- Supplies default `before_widget`, `after_widget`, `before_title`, and `after_title` wrappers.
- Registers the sidebar for WordPress widgets. Picker availability and rendered output depend on widget assignment; registration alone does not populate it.

Check theme-registered sidebar IDs as well as Bricks sidebars before choosing a name; the duplicate check covers only Bricks IDs and names.

## Tool availability

> **If a `bricks/*` ability is not available as a direct tool**: first check whether it is outside the fast path and call it through `mcp-adapter-execute-ability` with `ability_name: "bricks/<name>"`. If the dispatcher also rejects it, call `bricks-list-ability-status` to check whether a site admin disabled it under Bricks > AI.

## Typical flow: add a Shop sidebar, assign widgets

```
bricks/create-sidebar { name: "Shop Sidebar", description: "Product filters" }
  -> { sidebar: { id: "shop_sidebar", name: "Shop Sidebar", description: "Product filters" } }

# Widgets are still WordPress core. Assign them via Appearance > Widgets or the widgets REST API.

bricks/add-element
  postId: 99
  parentId: "mainc1"
  element:
    name: "sidebar"
    settings:
      sidebar: "shop_sidebar"
```

## Don't

- Don't send `{ id, name }` to `create-sidebar`; current schema accepts `name` and optional `description`.
- Don't assume deleted sidebar widgets move to inactive widgets. The delete ability removes the sidebar key from `sidebars_widgets`.
- Don't rename a sidebar by deleting and recreating it. Use `update-sidebar` to keep the ID stable.
