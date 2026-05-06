---
name: components
description: "Use when creating, editing, extracting, or deleting Bricks components. Covers properties, bindings, nested components, global-class property type, and what orphans when you delete a component in use."
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

# Bricks: components

A component is a reusable element tree stored globally. Drop an instance anywhere, edit the main component once, every instance updates. Think "React component" but serialized into the Bricks element tree and referenced by `"cid": "..."` on the host element.

> **If a `bricks/*` ability is not available as a direct tool**: first check whether it is outside the fast path and call it through `mcp-adapter-execute-ability` with `ability_name: "bricks/<name>"`. If the dispatcher also rejects it, call `bricks-list-ability-status` to check whether a site admin disabled it under Bricks > Settings > AI.

## Create

Right-click any element except Template or Filter -> **Save as component**. A dialog prompts for:

- **Name** (required): shown in the Components panel.
- **Category** (optional): groups the panel.
- **Description** (optional).

**Prefer `bricks/extract-component-from-elements` over manual copy-paste.** The extraction rewrites element ids cleanly, swaps the source subtree to an instance in one write, and snapshots a revision. Manual copy leaves duplicate ids and breaks future extraction.

## Label uniqueness

Component labels must be **unique across all components**. Attempting to create a duplicate returns `bricks_conflict_duplicate_component_name`. Read `list-components` before creating.

## Properties: the binding model

Properties are the only way to customize an instance without editing the main. Unconnected properties are dead weight.

### Common property types (Bricks 2.0+)

| Type | Binds to |
|------|----------|
| Text | Text / textarea controls |
| Rich text | Rich text control |
| Icon | Icon / Icon Box controls |
| Image | Image control |
| Image gallery | Gallery / Carousel controls |
| Link | Link controls (Button, Heading link, etc.) |
| Select | Text or Select controls |
| Toggle | Toggle controls (most commonly "Hide element") |
| Query loop (`query`) | Query loop control on layout elements |
| Global classes (`class`) | Global classes control (Bricks 2.0+) |

The stored `type` usually follows the connected control type. The builder also allows compatible matches such as `text` properties on textarea controls, `select` properties on text/textarea/editor controls, and `toggle` properties on checkbox controls (`ControlProperty.vue`).

### Defining a property

1. Open the main component's Properties panel (edit icon in the component's control panel, or the gear icon).
2. Add property: `name` (required), `description`, `group`, `default`.
3. Navigate to the target element inside the component.
4. Click the **purple `+` icon** next to the target control: pick the property.

A property that's defined but not connected to any control shows a broken-link icon and a warning. Fix by connecting or delete the property.

### Disconnecting

On the bound control, hover the property chip -> click the unlink icon. The control returns to its raw value.

### Global-class property (the underused one)

Instead of baking styling variants into the component, add a **Global classes** property and bind it to the Classes control on the styled element. Each instance picks one or more classes from the allowed list. This is the cleanest way to do `<Button variant="primary" | "secondary">` without multiple components.

Multiple global-class properties can bind to the same element: useful for orthogonal dimensions (size + color + emphasis).

### Toggle + "Hide element": DOM-level variation

A Toggle property connected to the "Hide element" control **removes the element from the DOM** at render time (not `display: none`). This is the performance-correct way to do optional sub-sections inside a component: no hidden DOM, no hidden images loading.

## Nested components

A component's element tree can contain instances of other components. That's how you compose (Card uses Button, PostGrid uses Card).

**Caveats the builder won't stop you from:**

- **Circular nesting**: Component A instances B, B instances A. The builder's component-children resolver has a circular-reference guard (`src/vue/store/actions/elements.js:1464-1475`), but that is not a save-time design validator and other recursive component paths still traverse nested instances. Always check: does this component's tree, directly or transitively, instance the component you're currently editing?
- **Property scoping**: a nested component's properties are separate from the outer component's. An outer property can't directly bind into an inner component's slot. You have to surface the binding by adding a matching property on the outer component and wiring it through: tedious but explicit.
- **Global resources follow the component**: classes (`.button`) and variables (`var(--space-m)`) referenced inside a component persist across instances. When sending a component to another site, those globals must exist there too or rendering breaks silently.

## Slots

Bricks components have a real **Slot** element (`includes/elements/slot.php`, registered since 2.2). Use it when an instance needs to provide arbitrary child elements inside the component.

How it works:

1. Add a Slot element inside the main component where instance content should render.
2. Instance-provided children are stored in `slotChildren`, keyed by the slot element id.
3. Frontend render resolves the slot from the parent component instance and renders those children in place.

Use slots for arbitrary child content. Use Text or Rich text properties for simple strings. `bricks/list-components` exposes `slotCount`; `bricks/get-component` returns the full component element tree, so count elements whose `name` is `slot` when you need the detailed shape.

## Instances: how changes propagate

- Editing the **main component** (purple-outlined) updates every instance immediately. This is by design: it's the feature.
- Editing an **instance** only overrides that instance's property values. Structural changes to an instance's tree are not possible: you can't add a sibling to an element inside an instance.
- To diverge one instance structurally, use the context-menu **Unlink component** action in the builder. It expands the instance into normal elements, resolves property values, preserves nested component references, and removes the host element's `cid` (`src/vue/components/common/TheContextMenu.vue:575-752`).

## Deletion: orphans and the placeholder

Deleting a component while instances exist leaves orphans. In the builder, each orphan instance renders as a **"missing component" placeholder**. The `"cid"` on the host element is still there; it just points to nothing.

Before deleting:

1. Call `bricks/get-design-context` with `includeUsage: true` and find the component's `usedOnPosts` list.
2. If usage is non-empty, show the user the list of posts and ask: replace usages first, or accept the orphans?
3. Never call `delete-component` on a component with known usage without explicit confirmation. `delete-component` returns a `beforeDelete.usageCount` snapshot, but by then the delete has already happened.

To clean up orphans after the fact: scan element trees for `"cid": "..."` referencing deleted ids (`bricks/audit-design-system` covers this), then use `update-element` or `set-page-elements` to strip the stale cid.

## Workflows

### Extract an element subtree into a component

```
extract-component-from-elements (
  postId: 123,
  rootElementId: "abc",
  label: "Card"
)
```

Returns the new component id + the revision snapshot. The subtree on the source post is replaced with an instance. Component extraction creates the component with an empty `properties` array (`includes/abilities/design.php:2581-2586`): convert literals to properties by editing the main component afterward.

### Retype a property (e.g. text -> rich text)

There is no "retype" operation. The workflow is:

1. Delete the property.
2. Add a new property with the target type.
3. Rebind the target control.
4. Update every instance to set the new property.

Step 4 is the painful one: do not retype properties on heavily-used components without warning the user.

### Rename a component

Labels are editable on the main component. The `cid` doesn't change, so all instances still resolve correctly. But every place the user visually scanned for the old name is now different: warn before renaming high-use components.

## Red flags

- **"Save as component" on a large subtree with many dynamic tags**: the extraction preserves tags but they now resolve against wherever the instance lands. A `{post_title}` deep inside a component behaves differently on a single post vs. a standalone page. Verify the component's dynamic-data assumptions before extracting.
- **Creating a component just to reuse styling**: global classes are the right tool, not components. Components are for shared structure + behavior, not shared CSS.
- **Components with 15+ properties**: you're building configuration, not a component. Split into multiple components that compose.
- **Editing an instance's properties to hack a one-off layout**: each property override is tech debt. Duplicate the component and rename if the divergence is real.
