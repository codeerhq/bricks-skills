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

A component is a reusable element tree stored globally. Instances reference the main component through `"cid": "..."` on the host element; editing the main component updates every instance.

> **If a `bricks/*` ability is not available as a direct tool**: first check whether it is outside the fast path and call it through `mcp-adapter-execute-ability` with `ability_name: "bricks/<name>"`. If the dispatcher also rejects it, call `bricks-list-ability-status` to check whether a site admin disabled it under Bricks > Settings > AI.

## Stored component shape

A valid component record has:

- `id`: same id as the root element.
- `elements`: flat Bricks element rows. The root element has `parent: 0` and the component label on `label`.
- `properties`: array of property definitions. Empty array is valid.
- `variants`: array of `{ id, name }`. Variant ids start with `variant-`.
- `_created`, `_user_id`, `_version`: builder metadata. If `_version` is missing, the builder treats the component as an old beta component and shows: `Components highlighted in red were created in Bricks 1.12-beta and are no longer supported. Please delete all of them.`
- Optional top-level fields: `category`, `desc`, `propertyGroups`, `blockEditor`, `blockCategory`, `blockIcon`, `blockPreviewImage`.

Do not hand-write global option records unless you are repairing data. Use component abilities so ids, property connections, parent-property references, validation, and metadata are handled consistently.

## Ability workflow

For MCP work, use this order:

1. Read first: `bricks/list-components`, `bricks/get-component`, or `bricks/get-design-context`.
2. Preserve `designSystemVersion` from the read response.
3. For `bricks/update-component`, pass `expectedDesignSystemVersion`. If the version changed, re-read and merge your edit into the newest component.
4. For `bricks/delete-component`, pass both `expectedDesignSystemVersion` and the reviewed `expectedUsageCount`. Do not pass `allowOrphans: true` unless the user explicitly accepted missing component instances.
5. Read back with `bricks/get-component` after create/update/extract. Confirm `_version`, properties, property groups, slots, nested component props, and `slotChildren`.

Treat `elements` on `bricks/update-component` as a full replacement tree. To edit one element, read the component, change only that element in the returned tree, then send the whole modified tree back with `expectedDesignSystemVersion`.

Slot IDs matter because instance slot content is keyed by slot element id. When replacing a component tree, preserve existing slot ids if you can. The ability remaps new slot ids by order where possible, and blocks removing slots that already have instance content unless you explicitly pass `allowSlotOrphans: true`.

## Reuse existing components

`bricks/list-components` returns component summaries with `label`, `desc`, properties, variants, slot count, and element count. `bricks-get-design-context` with `responseFormat: "summary"` also includes component summaries.

When building a page, section, card, CTA, listing item, testimonial, team member, or other repeated pattern, check the existing component labels/descriptions before creating a new component or raw element tree. If one clearly fits, inspect it with `bricks/get-component` and use a component instance (`{ "cid": "componentId" }`) with properties and `slotChildren` as needed.

Do not force reuse when the component's structure or property model does not match the requested design. Reuse is a design-system consideration, not a hard rule.

## Create

The builder's source-of-truth UI is **Save as component** on an element except Template or Filter. It prompts for:

- **Name** (required): shown in the Components panel.
- **Category** (optional): groups the panel.
- **Description** (optional).

**Prefer `bricks/extract-component-from-elements` over manual copy-paste.** The extraction rewrites element ids cleanly, swaps the source subtree to an instance in one write, and snapshots a revision. Manual copy leaves duplicate ids and breaks future extraction.

When creating a component, or editing one with an empty `desc`, write a concise useful description. Describe what the component is for and the main customization surface, for example: "Reusable listing card with image, price, address, meta, and optional featured badge." Avoid marketing copy, implementation trivia, and long prose.

When creating from scratch with the ability, pass either nested element objects or flat Bricks rows. The ability regenerates ids, so property `connections` may reference the ids in your input and will be remapped in the saved component.

```json
{
  "ability_name": "bricks/create-component",
  "parameters": {
    "label": "Metric card",
    "category": "marketing",
    "desc": "Small stat card with eyebrow, value, and supporting copy.",
    "elements": [
      {
        "id": "metric",
        "name": "div",
        "parent": 0,
        "children": ["eyebrw", "valtxt", "bodytx"],
        "settings": { "_cssGlobalClasses": ["card-shell"] }
      },
      {
        "id": "eyebrw",
        "name": "text-basic",
        "parent": "metric",
        "settings": { "text": "Listings sold" }
      },
      {
        "id": "valtxt",
        "name": "heading",
        "parent": "metric",
        "settings": { "text": "128" }
      },
      {
        "id": "bodytx",
        "name": "text",
        "parent": "metric",
        "settings": { "text": "Across the last twelve months." }
      }
    ],
    "properties": [
      {
        "id": "eyebrow",
        "label": "Eyebrow",
        "type": "text",
        "connections": { "eyebrw": ["text"] },
        "default": "Listings sold"
      },
      {
        "id": "value",
        "label": "Value",
        "type": "text",
        "connections": { "valtxt": ["text"] },
        "default": "128"
      }
    ]
  }
}
```

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

Ability shape:

```json
{
  "id": "title",
  "label": "Title",
  "type": "text",
  "desc": "Main visible heading.",
  "group": "content",
  "connections": {
    "abc123": ["text"]
  },
  "default": "Featured listing"
}
```

Supported property definition fields are `id`, `label`, `type`, `connections`, `default`, `desc`, `group`, `options`, `multiple`, and `replace`. Supported `type` values are `text`, `editor`, `icon`, `image`, `image-gallery`, `link`, `select`, `toggle`, `query`, and `class`.

`connections` is keyed by element id inside the component. Each value is an array of setting/control keys on that element. For a global-class property, connect to `_cssGlobalClasses`.

### Disconnecting

On the bound control, hover the property chip -> click the unlink icon. The control returns to its raw value.

### Global-class property (the underused one)

Instead of baking styling variants into the component, add a **Global classes** property and bind it to the Classes control on the styled element. Each instance picks one or more classes from the allowed list. This is the cleanest way to do `<Button variant="primary" | "secondary">` without multiple components.

Multiple global-class properties can bind to the same element: useful for orthogonal dimensions (size + color + emphasis).

### Toggle + "Hide element": DOM-level variation

A Toggle property connected to the "Hide element" control **removes the element from the DOM** at render time (not `display: none`). This is the performance-correct way to do optional sub-sections inside a component: no hidden DOM, no hidden images loading.

## Nested components

A component's element tree can contain instances of other components. That's how you compose (Card uses Button, PostGrid uses Card).

When creating an instance through an ability, `{ "cid": "componentId" }` is enough. The ability resolves the host element `name` from the referenced component root unless you intentionally pass a specific host name.

**Caveats the builder won't stop you from:**

- **Circular nesting**: Component A instances B, B instances A. The builder's component-children resolver has a circular-reference guard (`src/vue/store/actions/elements.js:1464-1475`), but that is not a save-time design validator and other recursive component paths still traverse nested instances. Always check: does this component's tree, directly or transitively, instance the component you're currently editing?
- **Property scoping**: a nested component's properties are separate from the outer component's. An outer property can't directly bind into an inner component's slot. You have to surface the binding by adding a matching property on the outer component and wiring it through: tedious but explicit.
- **Global resources follow the component**: classes (`.button`) and variables (`var(--space-m)`) referenced inside a component persist across instances. When sending a component to another site, those globals must exist there too or rendering breaks silently.

### Passing an outer property into a nested component

Use the nested component instance's `properties` map and a parent-property reference:

```json
{
  "id": "button",
  "name": "div",
  "parent": "card01",
  "cid": "cta123",
  "properties": {
    "label": "parent:cid_card01:prop_ctaText"
  }
}
```

The referenced component id is the current component root id, and the referenced property id is the outer component property. If the component is created through `bricks/create-component`, the ability remaps `parent:cid_<oldRoot>:prop_<property>` to the regenerated root id.

## Slots

Bricks components have a real **Slot** element (`includes/elements/slot.php`, registered since 2.2). Use it when an instance needs to provide arbitrary child elements inside the component.

How it works:

1. Add a Slot element inside the main component where instance content should render.
2. Instance-provided children are stored in `slotChildren`, keyed by the slot element id.
3. Frontend render resolves the slot from the parent component instance and renders those children in place.

Use slots for arbitrary child content. Use Text or Rich text properties for simple strings. `bricks/list-components` exposes `slotCount`; `bricks/get-component` returns the full component element tree, so count elements whose `name` is `slot` when you need the detailed shape.

Ability shape for an instance with slotted children:

```json
{
  "id": "card01",
  "name": "div",
  "parent": 0,
  "cid": "cardcmp",
  "slotChildren": {
    "slotid": ["head01", "body01"]
  }
}
```

The `slotChildren` key is the `id` of a `slot` element inside the referenced component `cardcmp`. The child ids must exist in the same post/component element tree and should use the component instance id as their `parent`.

For ability input, slot children may also be nested objects:

```json
{
  "name": "div",
  "cid": "cardcmp",
  "slotChildren": {
    "slotid": [
      { "name": "heading", "settings": { "text": "Custom headline" } },
      { "name": "text", "settings": { "text": "Custom body." } }
    ]
  }
}
```

## Instances: how changes propagate

- Editing the **main component** (purple-outlined) updates every instance immediately. This is by design: it's the feature.
- Editing an **instance** only overrides that instance's property values. Structural changes to an instance's tree are not possible: you can't add a sibling to an element inside an instance.
- To diverge one instance structurally, use the context-menu **Unlink component** action in the builder. It expands the instance into normal elements, resolves property values, preserves nested component references, and removes the host element's `cid` (`src/vue/components/common/TheContextMenu.vue:575-752`).

## Deletion: orphans and the placeholder

Deleting a component while instances exist leaves orphans. In the builder, each orphan instance renders as a **"missing component" placeholder**. The `"cid"` on the host element is still there; it just points to nothing.

Before deleting:

1. Call `bricks/get-design-context` with `includeUsage: true` and find the component's `usedOnPosts` list. The list can include posts/templates and component definitions that nest this component.
2. Capture `designSystemVersion` and the current usage count (`count(usedOnPosts)` for the target component).
3. If usage is non-empty, show the user the list and ask: replace usages first, or accept the orphans?
4. Never call `delete-component` on a component with known usage without explicit confirmation. `delete-component` blocks in-use deletes unless `allowOrphans: true` is explicitly passed. Pass the reviewed `expectedUsageCount`; if the count changed, re-read before deleting.

To clean up orphans after the fact: scan element trees for `"cid": "..."` referencing deleted ids (`bricks/audit-design-system` covers this), then use `update-element` or `set-page-elements` to strip the stale cid.

## Workflows

### Extract an element subtree into a component

```
extract-component-from-elements (
  postId: 123,
  rootElementId: "abc",
  label: "Card",
  category: "cards",
  desc: "Reusable card component."
)
```

Returns the new component id + the revision snapshot. The subtree on the source post is replaced with an instance. Component extraction creates the component with empty `properties` and `variants` arrays: convert literals to properties by editing the main component afterward.

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
