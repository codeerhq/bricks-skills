---
name: bricks-skills-update
description: "Use when the Bricks skills update check reports BRICKS_SKILLS_UPDATE_AVAILABLE, or when the user asks to update the Bricks skills pack."
allowed-tools:
  - Bash
  - Read
---

**Requires:** Bricks skills installed from `https://github.com/codeerhq/bricks-skills`

# Bricks: update skills

Use this skill when the update check prints:

```txt
BRICKS_SKILLS_UPDATE_AVAILABLE <old> <new> <tag>
```

## Upgrade flow

1. Locate the installed Bricks skills root:

```bash
_BS_UPDATE_CHECK=""
for _CAND in "$HOME/.bricks/skills/bricks-skills/scripts/bricks-skills-update-check" "$PWD/scripts/bricks-skills-update-check" "$HOME/.claude/skills/bricks-skills/scripts/bricks-skills-update-check" "$HOME/.codex/skills/bricks-skills/scripts/bricks-skills-update-check"; do
  [ -f "$_CAND" ] && _BS_UPDATE_CHECK="$_CAND" && break
done
echo "$_BS_UPDATE_CHECK"
```

2. If no path is found, tell the user the update checker is not available in this install and point them to the README install section.

3. Force a fresh check:

```bash
sh "$_BS_UPDATE_CHECK" --force || true
```

4. If it reports an available update, run the paired upgrade script. Pass the reported tag when available:

```bash
_BS_ROOT=$(cd "$(dirname "$_BS_UPDATE_CHECK")/.." && pwd)
sh "$_BS_ROOT/scripts/bricks-skills-upgrade" "<tag>"
```

If the update check did not include a tag, omit the argument. The script will fetch the latest GitHub Release tag itself.

5. If the upgrade script prints `BRICKS_SKILLS_NOT_GIT_INSTALL`, this install is managed by the host client rather than by a Bricks-owned git checkout. Tell the user to either:

- switch to the git install from the README, or
- update through their current client, for example `/plugin marketplace update bricks-skills` in Claude Code.

6. If the upgrade script prints `BRICKS_SKILLS_NO_RELEASE_FOUND`, no published GitHub Release is available yet. Tell the user to keep the current version.

7. If the upgrade succeeds and the user is using Claude Code plugin install from a local marketplace, tell them to run:

```txt
/plugin marketplace update bricks-skills
/reload-plugins
```

This refreshes Claude Code's installed plugin cache from the updated git checkout.

8. If the upgrade succeeds, read `CHANGELOG.md` and summarize the changes between the old and new versions in 3-5 bullets.

9. If the upgrade script prints `BRICKS_SKILLS_LOCAL_CHANGES_STASHED`, tell the user local changes were stashed in the skills repo and can be restored manually from that repo with `git stash pop`.
