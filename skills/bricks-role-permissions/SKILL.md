---
name: bricks-role-permissions
description: "Use when reading or changing which WordPress roles can use Bricks builder panels and features. Covers builder permission keys, custom builder capabilities, role access assignments, and why code execution stays outside MCP."
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

# Bricks: role permissions (via MCP)

Bricks builder access is not stored in `bricks_global_settings`.

It has two real stores:

1. Custom builder capability definitions live in `BRICKS_DB_CAPABILITIES_PERMISSIONS` (`bricks_capabilities_permissions`). Each row is `{ label, description, permissions }` and is keyed by a WordPress capability id.
2. Role access lives on WordPress roles. A role gets builder access when it has `bricks_edit_content`, `bricks_full_access`, or a custom builder capability id.

Use the dedicated permission abilities. Do not use `bricks/set-global-settings` for builder permissions.

These tools are default off in `Bricks > AI` because they can change builder access for WordPress roles. If `bricks-list-ability-status` reports `enabled: false` for this category, ask a human admin to opt in before continuing.

## Abilities

These are long-tail abilities. If the direct hyphenated tool is not available, call them through `mcp-adapter-execute-ability`.

- `bricks/list-builder-permissions`: read permission sections, default/custom capability definitions, role assignments, and the capability choices shown in the Builder access role select.
- `bricks/upsert-builder-capability`: create or update one custom builder capability definition.
- `bricks/set-builder-role-access`: assign existing builder access capabilities to WordPress roles. Empty string means no builder access. `administrator` is not writable because Bricks always treats administrators as full access.
- `bricks/delete-builder-capability`: delete one custom capability definition and remove that WordPress capability from all roles.

## Permission keys

Source of truth: `includes/builder-permissions.php`.

Do not guess keys. Start with `bricks/list-builder-permissions` and use the returned `permissionSections`.

Common sections:

- Post type access: `access_builder_{post_type}`, for example `access_builder_page`.
- General: `access_breakpoints_manager`, `access_page_settings`, `access_template_settings`, `access_revisions`, `delete_revisions`, `access_font_manager`, `access_icon_manager`.
- Templates: `create_templates`, `edit_templates`, `delete_templates`, `insert_templates`, `access_remote_templates`, `import_export_templates`.
- Global styles and settings: `edit_color_palettes`, `access_class_manager`, `access_variable_manager`, `access_theme_styles`, `access_query_manager`, `create_global_classes`, `edit_global_classes`, `delete_global_classes`, `assign_unassign_global_classes`, `lock_unlock_global_classes`, `copy_paste_global_classes_styles`, `access_pseudo_selectors`.
- Components: `insert_components`, `set_component_props`, `edit_components`, `create_components`, `delete_components`, `import_export_components`.
- Element editing: `access_element_content`, `access_element_styles`, `access_query_loop_builder`, `access_element_hide`, `access_element_conditions`, `access_element_interactions`, `duplicate_elements`, `delete_elements`, `move_elements`, `copy_paste_elements`, `copy_paste_element_styles`, `copy_paste_element_conditions`, `copy_paste_element_interactions`, `copy_paste_element_attributes`, `pin_unpin_elements`.
- Element-specific permissions are generated from registered elements: `add_element_{elementName}` and `edit_element_{elementName}`.

Keys such as `use_builder`, `template_manager`, `upload_json`, `use_components`, and `use_global_elements` are not current builder permission keys unless `list-builder-permissions` returns them.

## Create a custom access level

Create a capability definition first:

```json
{
  "ability_name": "bricks/upsert-builder-capability",
  "parameters": {
    "id": "bricks_marketer_access",
    "label": "Marketing access",
    "description": "Can edit content and insert templates, without design-system management.",
    "permissions": [
      "access_builder_page",
      "access_element_content",
      "access_revisions",
      "insert_templates"
    ]
  }
}
```

The id is a WordPress capability id. It must not be `bricks_full_access`, `bricks_edit_content`, or `bricks_no_access`.

## Assign roles

Assign an existing builder access capability to each role you want to change:

```json
{
  "ability_name": "bricks/set-builder-role-access",
  "parameters": {
    "roleAccess": {
      "editor": "bricks_marketer_access",
      "author": ""
    }
  }
}
```

The response includes `beforeSnapshot` and the resulting `roleAccess`. Report both when the change affects a real site.

## Code execution stays out of MCP

`executeCodeEnabled` and `executeCodeCapabilities` are excluded from Bricks settings abilities. The actual WP capabilities are `bricks_execute_code` and `bricks_execute_code_off` (`includes/capabilities.php`). These control custom PHP through echo tags, Code element PHP mode, SVG source code, and Custom Query PHP.

Raising code execution is a direct RCE boundary. If a task needs it, tell the user to change it in the Bricks admin UI.

## Do not

- Do not use `bricks/set-global-settings` for builder permissions.
- Do not send made-up permission keys. Read `list-builder-permissions` first.
- Do not assign a custom capability id before creating it.
- Do not try to change administrator builder access through MCP.
- Do not flip code-execution capabilities through MCP.
