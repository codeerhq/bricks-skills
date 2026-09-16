---
name: bricks-hooks-reference
description: "Find the correct Bricks PHP or frontend hook and its signature for an extension or debugging task."
---

# Bricks: hooks reference

Use this index to find a hook, then check its signature and call site in the target Bricks version before implementing a callback.

To confirm any hook and see its context in the current version, grep the source:

```bash
rg -n "apply_filters\(\s*['\"]bricks/hook_name_here" includes/
rg -n "do_action\(\s*['\"]bricks/hook_name_here" includes/
```

## The three rules that trip up every callback

1. **Filters must return**: forgetting `return $value` in a filter callback makes the value `null` for every downstream consumer. `bricks/element/render_attributes` is the most common foot-gun.
2. **Choose priority from the lifecycle**: inspect which callback must run first. A universal 20+ rule can miss registration or run after the value has already been consumed.
3. **Scope by `element_id` or post ID**: most render/query hooks pass a context object (`$query`, `$element`, `$post`). Use the ID supplied by that particular hook inside the callback to avoid mutating every loop/element on the page.

## Find the relevant hook

Read [the hook catalog](references/hooks.md) for the specific family: queries,
rendering, dynamic data, forms, filters, templates, assets or Builder events. Source
paths are optional lookup hints for a local checkout; customers can use the public
[developer reference](https://academy.bricksbuilder.io/developer/).

Check the actual callback arguments, return type and lifecycle before implementing.
`bricks/element/render` is a Boolean gate; `bricks/frontend/render_element` receives
HTML. Test both matching and unrelated targets so a scoped customization does not
change every element/query on the site.
