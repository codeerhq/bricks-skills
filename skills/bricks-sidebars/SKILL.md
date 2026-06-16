---
name: bricks-sidebars
description: "Use when registering or managing custom WordPress sidebars through Bricks: \"add a Shop sidebar\", \"rename the footer widget area\". Covers `bricks_sidebars` option shape and how Bricks sidebars surface in WP's widget admin."
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

# Bricks: sidebars (via MCP)

Bricks registers its own sidebars (widget areas) on top of theme-provided sidebars. They appear in `Appearance > Widgets` and in the Bricks Sidebar element picker.

Storage: `bricks_sidebars` option, as an ordered array of `{ id, name, description }` rows (`includes/abilities/sidebars.php`).

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

Avoid names that collapse to the same ID, such as `Shop Sidebar` and `Shop-Sidebar`.

## What Bricks does automatically

- Calls `register_sidebar()` for every Bricks sidebar during `widgets_init`.
- Supplies default `before_widget`, `after_widget`, `before_title`, and `after_title` wrappers.
- Surfaces the sidebar in the Sidebar element picker.

The duplicate check compares Bricks sidebar IDs and names. It does not prove the ID is unique against every theme-registered sidebar. Avoid common theme IDs such as `sidebar-1`, `footer-1`, and `shop_sidebar`.

## Tool availability

> **If a `bricks/*` ability is not available as a direct tool**: first check whether it is outside the fast path and call it through `mcp-adapter-execute-ability` with `ability_name: "bricks/<name>"`. If the dispatcher also rejects it, call `bricks-list-ability-status` to check whether a site admin disabled it under Bricks > AI.

## Typical flow: add a Shop sidebar, assign widgets

```
bricks/create-sidebar { name: "Shop Sidebar", description: "Product filters" }
  -> { sidebar: { id: "shop_sidebar", name: "Shop Sidebar", description: "Product filters" } }

# Widgets are still WordPress core. Assign them via Appearance > Widgets or the widgets REST API.

bricks/add-element
  postId: 99
  parentId: "main-content"
  element:
    name: "sidebar"
    settings:
      sidebarId: "shop_sidebar"
```

## Don't

- Don't send `{ id, name }` to `create-sidebar`; current schema accepts `name` and optional `description`.
- Don't assume deleted sidebar widgets move to inactive widgets. The delete ability removes the sidebar key from `sidebars_widgets`.
- Don't rename a sidebar by deleting and recreating it. Use `update-sidebar` to keep the ID stable.
