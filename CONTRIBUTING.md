# Contributing

Bricks Skills are only useful when they prevent real mistakes.

A good skill does not repeat the docs. It names the Bricks behavior that is easy to miss, explains the consequence, and gives the shortest reliable path through it.

## What makes a good skill

- **Lead with the failure mode.** "Theme styles with no conditions are ignored" is useful. "Configure theme styles correctly" is not.
- **Cite the source.** Every rule should trace back to Bricks source code, the Academy, or another reliable Bricks source. If you cannot cite it, mark it as uncertain or leave it out.
- **Keep it tight.** Short sentences. Direct instructions. No filler setup like "in this skill we will cover".
- **Separate fact from judgment.** If a rule is a product choice or safety boundary, say so.
- **Preserve Bricks terms.** Use the labels users see in the builder and in WP Admin.

## Structure

Each skill lives in its own folder under `skills/` with a single `SKILL.md`:

```text
skills/my-skill/
`-- SKILL.md
```

Add `references/` or `scripts/` only when the skill needs supporting material. Most skills should stay in one file.

## Frontmatter

```yaml
---
name: my-skill
description: Use when the user asks to [trigger phrase]. Covers [scope]. [Key failure mode].
---
```

Keep `name` identical to the folder name.

The `description` is used by skill loaders to decide when to activate the skill. Start with "Use when..." and include the phrases a user is likely to say.

## Voice

Match the Academy register where possible: direct, technical, and approachable.

These are not marketing pages. Do not use corporate gloss. Do not write around the point. Lists and tables are fine when they make the rule easier to scan.

## Before you open a PR

- Test the skill against a real Bricks site or a local Bricks checkout.
- Update `README.md` if you add, remove, or rename a skill.
- Update `.claude-plugin/marketplace.json` if the marketplace should expose the skill.
- Keep one skill per PR.

## License

By contributing you agree your work is licensed under GPL-2.0-or-later.
