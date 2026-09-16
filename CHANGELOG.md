# Bricks Skills Changelog

## 0.1.0

- Tighten discovery descriptions across all 45 skills and move conditional form, hook and provider details into references.
- Preserve inspection scope, existing-page insertion, shared design resources and actual breakpoint/loop context.
- Correct child-theme, custom-element, custom-tag, Sidebar, color-control and form recipes; remove unsupported credential-storage and performance claims.
- Add executable recipe tests and workflow evaluation cases; keep stable installations on stable release discovery.

- Align existing skills and bundled schemas with Bricks 2.4 stable.
- Document CSS, JavaScript, and PHP ability permissions, PHP opt-in migration, and partial HTML/CSS imports.
- Correct transfer-package custom-code restrictions, responsive style keys, WooCommerce cart tags and account state repair, form action conditions, and deferred Turnstile.
- Include File element guidance and the cart-content interaction trigger.
- Correct Code snippet versus execution behavior, nested slide loops, and the Tabs open-index setting.
- Preserve explicit user naming and authorization, and keep compatibility checks read-only outside authorized test fixtures.


## 0.1.0-beta.3

- Updates the skills for the Bricks 2.4 Beta 3 ability surface and editing workflows.
- Adds the file-oriented agent repository workflow for fast exact-target edits and durable multi-resource refactors.
- Updates design-system editing guidance for current ownership and digest checks, lock and category requirements, and explicit orphan/removal acknowledgements.
- Adds complete component digest preconditions and safe slot/deletion review guidance.
- Corrects palette, variable-category, breakpoint, pseudo-class, and shade-generation examples to use current read-before-write values.
- Treats scale generation as preview-only and routes persistence through guarded variable/category abilities.
- Documents compact enabled-only ability status results and exact/detailed disabled-state diagnostics.
- Improves HTML/CSS migration guidance for root-font normalization, browser-default semantic styles, code-sensitive output, scoped CSS, and rendered parity checks.
- Removes duplicated per-skill update checks from task execution; release upgrades are now explicit so ordinary Bricks work stays reproducible and avoids an extra shell/network check.
- Prevents update checks and upgrades from treating an older release as newer; explicit downgrades now require user intent.
- Ensures release-managed installs are pinned to the published release tag even when `main` reports the same package version.

## 0.1.0-beta.2

- Replaces removed global-data rollback instructions with the unified transfer-package backup and restore flow.
- Routes element catalog and schema lookups through the MCP dispatcher when they are not named direct tools.
- Makes the self-updater fail closed when local changes cannot be stashed or the worktree remains dirty, while supporting Git worktree installs.
- Adds package-contract validation, updater regression tests, and GitHub Actions checks for every push and pull request.
- Documents Codex and shared agent global skill directories for manual installs.

## 0.1.0-beta.1

- Documents WP-CLI as another transport for Bricks abilities while keeping MCP as the default skill workflow.
- Updates Bricks AI screen references to match the current `Bricks > AI` location.
- Documents the required `light`, `dark`, and `transparent` keys for scale categories in design-system guidance.

## 0.1.0-alpha.9

- Updates import/export guidance for the unified MCP transfer package flow.
- Documents list, export, inspect, and import abilities with explicit item selection and hash-checked imports.
- Adds safety guidance for conflicts, sensitive settings, code-bearing payloads, media import, and legacy tool avoidance.

## 0.1.0-alpha.8

- Prefixes public skill IDs and folders with `bricks-` to avoid collisions in mixed public skill environments.
- Updates the Claude Code marketplace manifest and README skill list to use the prefixed IDs.
- Keeps existing `bricks-settings` and `bricks-skills-update` IDs unchanged.

## 0.1.0-alpha.7

- Adds the mega-menus skill covering Bricks-native Nav Nested plus Dropdown mega menus and WordPress menu-backed mega menu setup.
- Documents the default decision path, menu-template assignment, safe WordPress menu editing, and verification checks for rich header navigation.
- Cross-links mega-menu guidance from start-here, headers-footers, and nestable-elements.

## 0.1.0-alpha.6

- Adds Bricks 2.4 WooCommerce setup guidance for the new MCP setup, status, and setup option abilities.
- Documents classic versus experimental modular Woo setup, safe page reuse/overwrite rules, and v2 state-element handling.
- Refreshes bundled element schemas to the Bricks 2.4 schema set, including advanced modular WooCommerce elements.

## 0.1.0-alpha.5

- Syncs the bundled color palette schema reference with the current Bricks MCP contract.
- Documents builder-shaped transparent palette shades with `light` or `dark` values.
- Adds palette shade metadata fields for dark mode, parent relationships, shade type, index, and utility classes.

## 0.1.0-alpha.4

- Clarifies component class properties as single-select by default and multi-select only with `multiple: true`.
- Documents class preset option IDs and `replace: true` behavior for component variants.
- Tightens the bundled component schema so class-property options require stable IDs.

## 0.1.0-alpha.3

- Adds element conditions guidance and interaction read/write verification.
- Expands component guidance for properties, slots, nested components, import/export safety, and reuse.
- Improves query-loop, element ID, and schema lookup guidance.

## 0.1.0-alpha.2

- Adds breakpoint awareness guidance for compact design context.
- Documents native Container and Block hints for HTML/CSS conversion.
- Clarifies Container usage as the section-level site-width wrapper, and avoids nested Containers or Sections.

## 0.1.0-alpha.1

- Adds concise guidance for batch element updates and verify-after-write checks.
- Recommends compact media searches before fetching full attachment detail.
- Clarifies when batching same-post element setting edits is appropriate.

## 0.1.0-alpha.0

- Initial Bricks skills pack.
- Adds the Bricks-owned update checker and upgrade skill.
- Uses GitHub Releases as the update channel.
- Includes the full GPL-2.0 license text.
