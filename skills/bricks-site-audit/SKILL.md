---
name: bricks-site-audit
description: "Use for a complete site-wide health check: \"audit my site\", \"what's wrong with my Bricks install\", \"check everything\". Covers design rot, template hygiene, revision bloat, dynamic-data mismatches, and Bricks abilities availability. For design-system-only audits, use bricks-audit-design-system instead."
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

# Bricks: site audit

A structured read-only audit. Uses only ability reads: never mutates.

> **If a `bricks/*` ability is not available as a direct tool**: first check whether it is outside the fast path and call it through `mcp-adapter-execute-ability` with `ability_name: "bricks/<name>"`. If the dispatcher also rejects it, call `bricks-list-ability-status` to check whether a site admin disabled it under Bricks > AI.

## Checks

### 1. Design-system rot

Call `bricks/audit-design-system` (scope: "all"). It returns severity-tagged issues covering orphan references, unused classes/variables/components, dead theme styles, and palette fragmentation. Use the **bricks-audit-design-system** skill for how to triage and fix the output.

Manual follow-ups the ability doesn't cover:
- **Duplicate-intent classes.** `.button` + `.btn`, `.card` + `.cards`. Read `list-global-classes` and scan names.
- **Single-use components.** `usageCount === 1` from `get-design-context` with `includeUsage: true`: was it meant to be reused, or should it be inlined back?

### 2. Template hygiene

Call `bricks/list-templates`.

- **Unused templates.** No condition, not referenced.
- **Overlapping template conditions.** Two templates both targeting `archive: products`: only one wins, the other is dead weight.
- **Missing default templates.** No default single template means the theme's built-in template runs, which may not be what the user expects.

### 3. Revision bloat

For posts with Bricks data, count revisions via `bricks/list-revisions`. Post with >50 revisions is a candidate for cleanup (revisions accumulate on every save).

### 4. Dynamic data

Call `bricks/list-dynamic-data-tags` and `bricks/list-cms-sources`.

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
- Unused classes (>30 days): <list>
- ...

## Components
- Orphans: <list>
- Single-use (candidates for inline): <list>

## Templates
- Overlapping conditions: <list>
- Unused: <list>

## Revisions
- Posts with >50 revisions: <list>

## Dynamic data
- Missing providers: <list>
- Broken tag syntax: <list>

## Bricks abilities
- Abilities version: <bricksAbilitiesVersion>
- Missing expected abilities: <list or none>
```

## Never do

- Never perform cleanup actions from this audit: only report. The user must explicitly approve any deletion or consolidation.
- Never blame the user. Phrase findings as observations, not judgments.
