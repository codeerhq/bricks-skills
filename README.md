# Bricks Skills

Bricks Skills are optional guidance files for MCP-compatible clients that use Bricks abilities through the WordPress MCP Adapter.

Bricks provides structured abilities that can read and change a Bricks site: inspect the design system, create templates, update elements, use dynamic data, render proposed element trees, manage media, and more.

Skills are the operating manual for those abilities. They tell the client which ability to call first, when to inspect the existing design system, how to avoid duplicate classes, how Bricks dynamic data is shaped, and when to fetch exact element/control schemas before writing.

The Bricks Abilities API is experimental. Test on local or staging sites first, and keep it off on sites that do not need it. Enable it under **Bricks Settings > AI > Abilities API**.

## Requirements

- Bricks 2.4+
- MCP Adapter plugin installed and active
- Bricks Abilities API enabled
- An MCP-compatible client that can load skills or plugin-style guidance

## Install

### Claude Code, self-updating install

Use this if you want the Bricks skills pack to check for updates itself instead of relying on Claude Code marketplace auto-updates.

```bash
git clone https://github.com/codeerhq/bricks-skills.git ~/.bricks/skills/bricks-skills
~/.bricks/skills/bricks-skills/scripts/bricks-skills-upgrade
```

Then add that local checkout as a Claude Code plugin marketplace:

```txt
/plugin marketplace add ~/.bricks/skills/bricks-skills
/plugin install bricks@bricks-skills
```

The upgrade script pins the checkout to the latest published GitHub Release. Each skill runs a small update check when filesystem tools are available. If a newer version is available, it tells the client to load `bricks-skills-update`. That skill updates the git checkout and tells you when to reload the plugin.

Updates follow the latest published GitHub Release tag, not `main`.

### Claude Code, quick install

```txt
/plugin marketplace add codeerhq/bricks-skills
/plugin install bricks@bricks-skills
```

This is shorter, but the installed plugin is managed by Claude Code. To update this install, run `/plugin marketplace update bricks-skills`.

### Manual install

```bash
git clone https://github.com/codeerhq/bricks-skills.git
# Symlink or copy the skill folders you want into your client's skills directory:
#   Cursor: .cursor/skills/
#   Claude Code project: .claude/skills/
#   Claude Code global: ~/.claude/skills/
```

Use symlinks if you want `bricks-skills-update` to update the source checkout and have the client pick up the changed skill files without copying them again.

## Why these skills exist

Bricks exposes a lot of site behavior through structured data, and many mistakes look successful at first.

Each skill covers one Bricks area and focuses on the rules that are easiest to miss.

## Skills

| Skill | What it covers |
|---|---|
| **start-here** | Session setup, design-context reads, write verification, duplicate handling. |
| **bricks-skills-update** | Bricks-owned update checks and git-based skill pack upgrades. |
| **naming-conventions** | Existing class, variable, and component naming patterns. |
| **plan-from-brief** | Turning a brief into an MCP write plan without guessing site state. |
| **design-systems** | Global classes, variables, palettes, theme styles, and components. |
| **seed-design-system** | Creating a design system on a new Bricks site. |
| **audit-design-system** | Read-only checks for unused tokens, dead styles, and design drift. |
| **site-audit** | Site-wide read-only checks across templates, dynamic data, revisions, and Bricks abilities availability. |
| **query-loops** | Query loop setup, layout traps, pagination, custom queries, and empty renders. |
| **components** | Slots, nested components, property binding, extraction, and reuse. |
| **custom-code** | Custom CSS, JS, PHP, code signatures, and safe extension points. |
| **hooks-reference** | Bricks hooks by use case, with scope and safety notes. |
| **forms** | Fields, actions, submissions, spam checks, SMTP, and webhooks. |
| **query-filters** | Filter elements, target query binding, indexing, and AJAX behavior. |
| **popups** | Popup templates, triggers, display rules, close behavior, and debugging. |
| **interactions** | Interaction triggers, actions, animation cost, and frontend verification. |
| **nestable-elements** | Accordion, tabs, slider, dropdown, offcanvas, and nested structure rules. |
| **templates-conditions** | Template types, display conditions, scoring, and winner selection. |
| **dynamic-data** | Dynamic tags, providers, modifiers, preview checks, and empty output. |
| **woocommerce** | Product loops, WooCommerce templates, cart fragments, and checkout limits. |
| **performance** | CSS loading, asset checks, cache behavior, queries, fonts, and images. |
| **custom-elements** | Child-theme or plugin elements, controls, rendering, and builder preview parity. |
| **custom-controls** | Custom builder controls, value shape, control registration, and CSS output. |
| **custom-dynamic-data-providers** | Dynamic data provider registration, tag output, context, and security. |
| **child-theme-patterns** | Safe child-theme structure for Bricks customizations. |
| **figma-to-bricks** | Moving from Figma output to Bricks without importing design-system debt. |
| **html-css-to-bricks** | HTML/CSS conversion, class collisions, CSS-only imports, and manual fallback cases. |
| **element-schemas** | Bundled exact element, control, global, and settings schemas on demand. |
| **media-assets** | Uploading, finding, and wiring WordPress media into Bricks elements. |
| **browser-verify** | Frontend checks after MCP writes, including responsive and AJAX states. |
| **site-reproduction** | Rebuilding an existing site in Bricks while preserving structure and intent. |
| **global-queries** | Creating, updating, deleting, and using reusable global queries. |
| **maintenance** | CSS regeneration and orphaned element cleanup. |
| **bricks-settings** | Reading and changing safe global settings through the MCP allow-list. |
| **sidebars** | Bricks-registered WordPress sidebars and widget behavior. |
| **import-export** | Template import/export, id handling, and migration checks. |
| **breakpoints** | Responsive breakpoints, cascade direction, and setting storage. |
| **role-permissions** | Builder access, capabilities, and permission matrices. |
| **custom-fonts** | Custom font registration, faces, formats, and frontend output. |
| **headers-footers** | Header and footer templates, area routing, and element writes. |
| **ai-tab** | Bricks AI settings, MCP ability groups, and ability availability checks. |
| **quality-gate** | Verify-after-write checks for MCP mutations. |

## Release channel

Bricks skills updates use GitHub Releases. The updater checks the latest published release tag from `codeerhq/bricks-skills`, compares it to the local `VERSION`, and upgrades the git checkout to that tag.

Release flow:

1. Update the skills.
2. Bump `VERSION`.
3. Add notes to `CHANGELOG.md`.
4. Create a GitHub Release with a tag matching the version, for example `v0.1.0-alpha.1`.

Do not rely on `main` as the user-facing update channel.

## How this works with the Bricks MCP

Bricks exposes abilities through the WordPress Abilities API. The MCP Adapter exposes registered WordPress abilities to MCP-compatible clients, including Bricks abilities and abilities from other plugins.

These skills reference Bricks ability names with slashes, for example `bricks/get-design-context` and `bricks/set-page-elements`. Direct MCP tool names use hyphens, so `bricks/get-design-context` is called as `bricks-get-design-context`. Other enabled abilities are called through `mcp-adapter-execute-ability` with the slash ability name in `ability_name`. If Bricks is not active, the MCP Adapter is unavailable, or a site admin disables an ability under **Bricks > Settings > AI**, the related ability will not be callable.

The skills are still useful when writing custom PHP against Bricks. For example, the custom-code and custom-elements skills explain Bricks-specific extension points even when the MCP is not involved.

## Schema references

The `element-schemas` skill includes the full resolved Bricks schema bundle as supporting files. Clients should not load the whole bundle into context. They should fetch the one element, control, global-data, page-settings, or template-settings schema needed for the current write.

When connected to a Bricks site, runtime MCP readbacks stay authoritative for what exists on that site. The bundled schemas explain exact value shapes for controls such as images, links, queries, repeaters, typography, forms, interactions, globals, and settings.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Short version: one skill per PR, focus on behavior that is easy to get wrong, and cite the Bricks code path or Academy page behind each rule.

## License

GPL-2.0-or-later. See [LICENSE](LICENSE).
