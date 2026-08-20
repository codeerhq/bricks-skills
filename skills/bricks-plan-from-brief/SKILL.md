---
name: bricks-plan-from-brief
description: "Use when the user gives a broad, new, or ambiguous freeform Bricks brief such as building a pricing page, adding a substantial homepage region, or coordinating multiple resources. Turns it into a concrete ability-call plan before writes. Do not use for a known scalar or exact single-target edit."
---

**Requires:** Bricks 2.4+ with the Abilities API enabled

# Bricks: plan from a brief

When the user describes broad or ambiguous work such as "build a pricing page" or
"add a hero to the homepage", do not immediately write. Establish the minimum site
state needed for a concrete plan. For a known scalar or exact target edit, skip this
skill and use the focused fast path.

> **If a `bricks/*` ability is not available as a direct tool**: first check whether it is outside the fast path and call it through `mcp-adapter-execute-ability` with `ability_name: "bricks/<name>"`. If the dispatcher also rejects it, call `bricks-list-ability-status` to check whether a site admin disabled it under Bricks > AI.

## Step 1: Read the site

Read only the surfaces needed by the brief; parallelize independent reads:

- `bricks/get-mcp-version` only when compatibility or availability is uncertain.
- `bricks/get-design-context` when the brief creates or reuses design resources.
- `bricks/list-cms-sources` when dynamic content or an unknown post type is involved.
- `bricks/list-templates` when template routing or reuse is involved.
- If the brief references a specific page: `bricks/find-post` + `bricks/get-page-elements`.

## Step 2: Translate the brief into resources

For each sentence in the brief, identify which Bricks primitives it maps to:

- "Pricing table" -> element tree on a post, likely reusing an existing `.card` component if one exists.
- "Primary button" -> existing `.button` class or `.button-primary`? Don't create a new class; reuse.
- "New service landing page" -> `bricks/create-post` + `bricks/set-page-elements`. Consider attaching a header/footer template via `bricks/set-template-conditions`.
- "Make it responsive" -> element settings carry breakpoint-keyed values (`desktop`, `tablet_portrait`, `mobile_landscape`, `mobile_portrait`). Don't invent new breakpoints: use the site's existing ones from `get-page-elements` output on any responsive element.
- "Match our brand" -> use existing palette + theme styles. Never invent new brand colors.

## Step 3: Identify gaps

For each resource the brief needs, mark it as **exists / missing / ambiguous**:

- **Exists:** reuse. List the id/name in the plan.
- **Missing:** add a create/write step to the plan. Name it to match site conventions (see **bricks-naming-conventions** skill).
- **Ambiguous:** the brief says "CTA button" but there are two candidate classes. List both options in the plan and ask the user which to reuse.

## Step 4: Order the plan

1. Design-system writes first (classes, variables, components). They're referenced by downstream writes.
2. Content writes second (pages, templates).
3. Wire-up writes last (template conditions, menu entries).

Within each tier, destructive writes last. Prefer small reversible writes while planning. Batch independent same-post element setting edits only when one revision is acceptable.

## Step 5: Present the plan

Before executing, show the user:

- The plan as a numbered list: one bullet per ability call, human-language summary + ability name.
- The list of existing resources you'll reuse.
- The list of new resources you'll create, with names.
- The list of ambiguities that need their input.

Then wait for approval. Do not execute until they sign off.

## Step 6: Execute

Call abilities in order. After each mutation, capture the response (especially `revisionId` / resource id). After each meaningful milestone, verify with a read before moving on. Report what you did and what the user needs to check in the builder.

## Red flags that mean stop and ask

- Brief mentions a feature/plugin that isn't installed (check `list-cms-sources`, `list-dynamic-data-tags`).
- Brief requires creating 5+ new global classes: likely the user hasn't seen the existing design system and is about to fragment it.
- Brief names a specific file / template / component that doesn't exist: confirm the spelling, don't silently create a new one.
