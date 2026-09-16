---
name: bricks-site-audit
description: "Audit Bricks site data, references, templates and ability availability. Report scan coverage; runtime, accessibility and performance need separate evidence."
---

# Bricks: site audit

A read-only data/configuration audit. Report actual coverage and access limits.
It does not by itself certify frontend rendering, accessibility, performance,
security or every third-party integration. Add those checks only when requested
or needed to investigate an observed finding; disclose unavailable evidence.

> **If a `bricks/*` ability is not available as a direct tool**: first check whether it is outside the fast path and call it through `mcp-adapter-execute-ability` with `ability_name: "bricks/<name>"`. If the dispatcher also rejects it, call `bricks-list-ability-status` to check whether a site admin disabled it under Bricks > AI.

## Checks

### 0. Complete Bricks document inventory

Call `bricks/checkout-site-repository` with `includeDesign: false`,
`includeDependencies: false`, and the maximum `perPage`. Follow every returned
`nextCursor` while `hasMore` is true. This is the authoritative bounded inventory of
editable Bricks pages, posts, custom-post-type documents, and templates for the
audit. Record every `postId`, `postType`, `file`, `status`, `documentDigest`, and
element count. If the
scan cannot complete, label the entire audit incomplete; do not silently report a
site-wide result.

Use this inventory for the revision and dynamic-data checks below. `list-templates`
still supplies template conditions and settings, but it is not a substitute for the
complete document inventory.

Process inventory pages incrementally. Extract findings from each full document and
discard its tree before reading the next one. If the complete scan exceeds available
tool or context limits, report the exact completed coverage and ask whether to
continue. Never label a partial scan complete.

### 1. Design-system rot

Call `bricks/audit-design-system` (scope: "all"). It returns severity-tagged issues covering orphan references, unused classes/variables/components, inactive theme styles, and palette fragmentation. Use the **bricks-audit-design-system** skill for how to triage and fix the output.

Manual follow-ups the ability doesn't cover:
- **Duplicate-intent classes.** `.button` + `.btn`, `.card` + `.cards`. Read `list-global-classes` and scan names.
- **Single-use components.** `usageCount === 1` from `get-design-context` with `includeUsage: true`: single use is not a defect; report only when it creates a concrete maintenance problem.

### 2. Template hygiene

Call `bricks/list-templates` and follow `page`/`perPage` while `hasMore` is true
before claiming the audit covers every template.

- **Potentially unused templates.** Check insertion, nesting, popup/menu and other references. No placement conditions alone does not mean unused.
- **Overlapping template conditions.** Compare priorities and representative matching URLs. Overlap can be intentional fallback/override behavior; identify actual shadowing before recommending removal.
- **Missing default templates.** No default single template means the theme's built-in template runs, which may not be what the user expects.

### 3. Revision bloat

For every post ID in the completed document inventory, count revisions via
`bricks/list-revisions`. Report counts and retention/storage context. A count alone does not establish bloat
or authorize cleanup; revisions may be intentional recovery history.

### 4. Dynamic data

Call `bricks/list-dynamic-data-tags` and follow `page`/`perPage` while `hasMore` is
true, then call `bricks/list-cms-sources`. Use relevant `postId` contexts when
provider tags vary by post type.

For every inventoried `postId`, call `bricks/get-page-elements` to read the complete
stored element tree, then scan every element setting for dynamic-tag
references. If any document cannot be read, disclose that target and mark this check
incomplete.

- **Missing providers referenced in content.** Posts using `{acf_foo}` on a site without ACF installed. Check by scanning element settings for `{*}` patterns that don't resolve against `list-dynamic-data-tags`.
- **Ambiguous modifiers.** Tags using `|upper` (JS pipe syntax) instead of `:upper` (Bricks syntax): broken.

### 5. Bricks abilities

Call `bricks/get-mcp-version`. Record `bricksVersion`, `bricksAbilitiesVersion`, `adapterVersion`, `wordpressVersion`, `abilitiesApiActive`, and `disabledAbilityCount`. If an expected `bricks/*` ability is missing as a direct tool, remember that many abilities are dispatcher-only; call `bricks/list-ability-status` before concluding the site is outdated or misconfigured.

## Report format

Return a structured audit:

```
## Design system
- Fragmentation: <count> issues
- Duplicate-intent classes: <list>
- Unused classes in the current authoritative scan: <list>
- ...

## Components
- Orphans: <list>
- Single-use (informational only): <list>

## Templates
- Overlapping conditions: <list>
- Unused: <list>

## Revisions
- Revision counts and retention concerns: <list>

## Dynamic data
- Missing providers: <list>
- Broken tag syntax: <list>

## Bricks abilities
- Abilities version: <bricksAbilitiesVersion>
- Missing expected abilities: <list or none>
```

## Never do

- A report-only audit does not authorize cleanup. When fixes are also requested, use the relevant scoped repair workflow and existing authorization; ask only about unresolved destructive choices.
