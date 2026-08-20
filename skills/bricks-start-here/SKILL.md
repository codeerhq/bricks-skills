---
name: bricks-start-here
description: Use when the task environment explicitly announces bricks.workspace/v1, or when a Bricks task is broad, destructive, or has no page, template, component, or design target named by title, slug, ID, or path. Never load for one named target when direct ability schemas are available unless the explicit host workspace capability is present.
---

# Bricks orientation

Use Bricks abilities as the authoritative interface to the connected WordPress site. Runtime reads override bundled examples and schemas.

## Fast routing

- **Explicit host workspace:** when the task environment itself announces the
  `bricks.workspace/v1` capability, edit only the authorized projected files with
  ordinary file tools. The host owns validation, persistence, and authoritative
  readback after the agent finishes. Do not add MCP discovery or commit calls to
  that route.
- **Known single existing target:** call the narrow read/write abilities directly. If `bricks-resolve-agent-file` and `bricks-commit-agent-file` are available, their schemas provide a self-contained two-call path; do not load another skill merely to repeat that contract.
- **New visual section, page, or static template shell:** load **bricks-html-css-to-bricks** and convert semantic HTML/CSS before persistence.
- **New homepage plus site identity, brand system, or whole-site direction on a fresh install:** call `bricks-commit-site-foundation` with one compact manifest. It owns the palette, fluid scales, root theme style, globally conditioned header/footer templates, page-body import, and front-page setting. Do not preflight it with low-level design reads: the ability refuses non-greenfield state and same-key retries resume safely. Load the three low-level skills only when this compound ability is unavailable.
- **Small exact existing-site edit:** no skill is required. Prefer the self-described one-call `commit-exact-site-edits` route for supported page text/structure, component definition fields, global-variable values, and class/theme-style leaves. It accepts exact IDs or exact unique human names and exact current text/labels where its live schema advertises them. Supply `expectedValue`, or literal `allowBlindWrite: true` only when the user intentionally supplied that exact target and requested replacement regardless of its current value.
- **Typed target discovery, an oversized/complex page, dependency analysis, recovery, or 2-25 coordinated resources outside the exact route:** load **bricks-agent-repository**. Prefer `checkout-site-edit-map` → `commit-site-edit-plan` only when the live schema/response advertises the requested operation; otherwise use canonical files.
- **Create or substantially redesign a design system:** load **bricks-design-systems** or **bricks-seed-design-system**.
- **Component schema/slot/property work:** load **bricks-components**.
- **Dynamic data, queries, filters, forms, interactions, conditions, media, or templates:** load only the matching task skill.

Do not call version, start-here, the full ability catalog, design context, or a site manifest when the exact target and narrow ability are already known.
Never infer `bricks.workspace/v1` from filenames, a skill installation, or a local
`.bricks` directory. Without an explicit host capability announcement, WordPress
abilities remain the write path.

## Invariants

1. Before directly **creating** a class, variable, palette color, theme style, or component, call `bricks-get-design-context` with `responseFormat: "summary"`; reuse compatible existing resources and breakpoints. The exceptions are `bricks-commit-site-foundation` for a full greenfield site and `bricks/commit-html-css-page-import` when the task is only one known empty page body. Both read the state they need; do not add redundant discovery calls. The page importer does not create palettes, scales, theme styles, components, or templates, so never use it alone for a whole-site brief. Do not force same-named duplicates.
2. For an unfamiliar element or complex setting, inspect `bricks/get-element-schema` through the dispatcher and consult **bricks-element-schemas** for nested control values. Never guess a query, media, form, interaction, or condition shape.
3. Element IDs are six characters. Preserve IDs and parent/children references in existing flat trees; nested create input may omit IDs when the ability permits generation.
4. Preserve opaque fields, component slots/properties/variants, and unrelated resources. Respect every expected version, digest, ownership value, and usage count returned by the matching current read.
5. Treat returned authoritative readback, revision, version, and digest as the result. On ambiguity, stale state, partial commit, or manual recovery, stop and follow the returned recovery route instead of guessing or retrying under a new key.
6. Destructive writes require explicit user approval. Global data has no post-revision undo; export supported affected items before destructive global changes.
7. Use rendered frontend HTML for verification, never as editable source.

## Access and verification

Direct tools use hyphenated names for slash-named abilities. If an enabled ability is not direct, call `mcp-adapter-execute-ability` with its `bricks/...` name. If execution says it is disabled, inspect dispatcher ability `bricks/list-ability-status`; do not route around an administrator decision.

After broad page/template/component changes, verify persisted state and the frontend. Use **bricks-browser-verify** when browser access exists. For one focused write, do not add redundant reads when the mutation already returns authoritative readback.

For dynamic tags, enumerate `bricks/list-dynamic-data-tags` for a relevant post and preview every tag before persistence. Never invent provider tag names.
