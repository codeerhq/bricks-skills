## Global variables

- **Use the scale generator** (`bricks/generate-scale-variables`) for typography and spacing. Do not hand-author static spacing or type variables that match a configured scale prefix. The generator handles both typography and spacing using the category's scale configuration.
- When `get-design-context.variableCategories` includes spacing or typography categories with `scale`, pass the existing `categoryId` to `generate-scale-variables`. The generated names inherit the configured prefix, such as `space-` or `text-`.
- The scale generator resolves the html base font-size from three sources in order: **style manager value -> theme styles -> `10px` default**. If your scale outputs unexpected pixel values, that order is why.
- Variable names must be unique **at save time**, but **the builder UI does not validate this on create**: call `list-global-variables` first and guard against duplicates before writing. Conflict returns `bricks_conflict_duplicate_global_variable_name` on save.
- Variables are referenced in CSS as `var(--{name})`. Use the bare name (`space-m`, not `--space-m`) when creating: Bricks adds the `--` prefix when emitting CSS.
- When building a fluid scale, use the Bricks scale shape. `category.scale` has **four keys the builder cannot work without**, plus the math knobs:
  - `scaleScope`: **`"typography"` or `"spacing"`, nothing else.** Style Manager has one fixed tab per scope and lists a category only when `scale.scaleScope` matches the open tab. Omit it and the scale still shows a "scale" badge in the Variable Manager, still blocks hand-authored values for its prefix, and still gets cascade-deleted with the category — but **Style Manager > Typography/Spacing will be empty and the user can never edit or regenerate it**.
  - `scaleNames`: the ordered step names, e.g. `["2xs","xs","s","m","l","xl","2xl"]`. **This list is the scale's extent.** `regenerateVariables()` (fires when the html font size or min/max screen width changes, and on import) derives each variable's step from its *index in this list*. Omit it and the baseline index collapses to `0`, silently rewriting every variable at the wrong step.
  - `baseline`: must be one of the `scaleNames` entries. Default t-shirt baseline is `m`.
  - `prefix`: e.g. `text-`, `space-`.
  - Math knobs: `scaleType` (`tshirt` | `numeric` | `custom`), `minFontSize`, `maxFontSize`, `minScaleRatio` / `minScaleRatioSelect`, `maxScaleRatio` / `maxScaleRatioSelect`. Note: `*ScaleRatioSelect` wins unless it is the literal string `"custom"`, in which case `*ScaleRatio` is used.
- **Keep `scaleRange` and `scaleNames` in agreement.** The builder generates exactly one variable per `scaleNames` entry. `generate-scale-variables` instead takes a `scaleRange: { from, to }`, so it is possible to generate 11 variables against a 7-entry `scaleNames` — after which the Style Manager preview and `regenerateVariables()` both map variables onto the wrong steps. `scaleRange: { from: -2, to: 4 }` matches a 7-name list with baseline at index 2.
- `generate-scale-variables` with `save: false` returns candidate variables. Review names, values, and scope before saving; existing authorization to create the scale covers the matching persistence step.
- `generate-scale-variables` does not support saving with `save: true`. Persist the
  previewed rows with `set-global-variables`, using one fresh
  `list-global-variables` response's `variableOwnership` and `categoryOwnership`.
  If the category itself must change, first send the complete preserved category
  list to `set-global-variable-categories` with both current ownership values,
  then re-read before saving variables.
- Global variables are stored in a global option, not post revisions. Use `delete-global-variable` for cleanup of individual variables; it returns a `beforeDelete` snapshot.
- `set-global-variables` is an upsert, not a full replacement. Pass both current
  variable/category ownership values. `set-global-variable-categories` is a full
  category replacement and also requires both current values. `delete-global-variable`
  requires the row's `itemOwnership` plus literal `allowOrphans: true` after review.

