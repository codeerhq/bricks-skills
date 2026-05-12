---
name: element-conditions
description: "Use when creating or debugging Bricks element display conditions: \"show this block only for logged-in users\", \"hide this CTA on product archives\", \"why is this element not rendering?\". Covers `_conditions`, OR groups, AND items, dynamic-data conditions, and the update-element-conditions MCP writer."
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

# Bricks: element conditions

Element conditions decide whether an individual element renders. They are not CSS visibility toggles. If conditions do not match, Bricks does not render the element markup.

Use this skill for `element.settings._conditions`. Use **templates-conditions** for template display rules such as where a header, popup, archive, or content template applies.

## The schema

Storage key: **`_conditions`** on `element.settings`.

The shape is an outer array of OR groups. Each group is an inner array of AND items:

```json
[
  [
    { "id": "abc123", "key": "user_logged_in", "compare": "==", "value": true },
    { "id": "def456", "key": "post_status", "compare": "==", "value": "publish" }
  ],
  [
    { "id": "ghi789", "key": "dynamic_data", "dynamic_data": "{post_title}", "compare": "contains", "value": "Sale" }
  ]
]
```

Meaning:

- The element renders when any outer group matches.
- Every item inside a matching group must match.
- `conditions: []` clears all conditions.
- Do not save an empty group such as `[[]]`. An empty group behaves like an always-true group in runtime logic.

## Condition item fields

| Field | Required | Notes |
|---|---:|---|
| `id` | No | Unique row ID. The MCP writer generates it when omitted. |
| `key` | Yes | Condition type, such as `user_logged_in`, `post_id`, `dynamic_data`, or `woo_product_stock_status`. |
| `compare` | No | Defaults to `==`. Use `empty` or `empty_not` when no `value` is needed. |
| `value` | Usually | Required unless `compare` is `empty` or `empty_not`. |
| `dynamic_data` | Only for `key: "dynamic_data"` | Dynamic tag to evaluate, such as `{post_title}`. Still provide `value` unless using `empty` or `empty_not`. |

## Compare operators

Core operators:

```txt
==, !=, >=, <=, >, <, contains, contains_not, empty, empty_not
```

Use value types that match the condition. For booleans, send real booleans (`true`, `false`), not strings. For IDs, send integers when possible. For dates and times, use the same format the builder control expects.

## Core condition keys

General:

```txt
browser, current_url, date, datetime, dynamic_data, featured_image,
operating_system, referer, time, weekday
```

Post:

```txt
post_author, post_date, post_id, post_parent, post_status, post_title
```

User:

```txt
user_id, user_logged_in, user_registered, user_role
```

WooCommerce:

```txt
woo_product_category, woo_product_featured, woo_product_new,
woo_product_purchased_by_user, woo_product_rating, woo_product_sale,
woo_product_sold_individually, woo_product_stock_management,
woo_product_stock_quantity, woo_product_stock_status, woo_product_tag,
woo_product_type
```

Custom integrations can add condition keys through Bricks filters. The dedicated MCP writer accepts core keys plus keys registered through `bricks/abilities/element_conditions/allowed_keys`.

## MCP abilities for element conditions

- `get-element-conditions`: read the element's `_conditions` array.
- `update-element-conditions`: replace the element's `_conditions` array. Full replacement only. Generates missing row IDs. Takes a pre-save revision.

Prefer the dedicated writer over generic `update-element` when changing `_conditions`. It validates the OR/AND shape and catches empty groups, missing keys, invalid compare operators, and incomplete dynamic-data conditions before saving.

## Safe workflow

1. Read the element with `get-page-elements` or `get-element-conditions`.
2. Preserve any existing groups you are not intentionally replacing.
3. Write the full `conditions` array with `update-element-conditions`.
4. Confirm the returned `revisionId` exists with `list-revisions`.
5. Read back with `get-element-conditions`.
6. Verify the page in a browser when the condition depends on runtime state such as login, URL, date/time, WooCommerce product context, or dynamic data.

## Examples

Logged-in users only:

```json
{
  "postId": 123,
  "elementId": "abc123",
  "conditions": [
    [
      { "key": "user_logged_in", "compare": "==", "value": true }
    ]
  ]
}
```

Specific post IDs:

```json
{
  "conditions": [
    [
      { "key": "post_id", "compare": "==", "value": 42 }
    ],
    [
      { "key": "post_id", "compare": "==", "value": 89 }
    ]
  ]
}
```

Dynamic data contains text:

```json
{
  "conditions": [
    [
      {
        "key": "dynamic_data",
        "dynamic_data": "{post_title}",
        "compare": "contains",
        "value": "Sale"
      }
    ]
  ]
}
```

Clear all element conditions:

```json
{
  "conditions": []
}
```

## Debug order

1. **Element does not render.** Read `_conditions`; if any group is intended to match, check each item in that group. One false item makes the whole group false.
2. **Element renders everywhere.** Look for an empty group or a condition using `empty` against a value that is always empty in the current context.
3. **Dynamic-data condition fails.** Confirm `dynamic_data` is present, the tag renders in the current post context, and the `value` comparison matches the rendered string.
4. **WooCommerce condition fails.** Confirm the page is in a product context and WooCommerce is active.
5. **Template and element conditions disagree.** Template conditions decide whether the template renders at all. Element conditions only run after the template/page element tree is already chosen.

## Never do

- Do not use template condition shapes (`{ "main": "any" }`) inside element `_conditions`.
- Do not save `[[]]` or groups with only generated IDs and no `key`.
- Do not use element conditions as a styling system. Use CSS or responsive/hide controls when markup should stay in the DOM.
- Do not guess custom condition keys. Read the live schema or integration docs first.
