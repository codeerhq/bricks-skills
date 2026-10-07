## Color palettes

- Palettes are ordered arrays of colors. Each color has an id, `light` and optional
  `dark` value, plus a `raw` CSS-variable reference; individual colors do not have a
  separate display-name field.
- **Formats usually round-trip.** Light and dark shades preserve the parsed base format. Transparent shades are emitted as HSL/HSLA because the builder's transparent-shade path changes alpha directly.
- Before creating a new palette, check whether the existing primary palette has the color. Fragmented palettes are the most common design-system mess.
- **Generating shades.** Use `bricks/generate-color-shades` to produce light, dark, or transparent ramps from a base color. The ability uses Bricks' PHP color helper, ported from the builder Color Shades popup, so previews should match the builder math. Shade `raw` names become `var(--{base-variable}-{l|d|t}-{index})` only when the base color has a `raw` value such as `var(--brand-primary)` or when `baseVariable` is passed. Without that variable reference, each generated shade keeps the base raw value. Preview with `save: false`, then pass that exact preview's `saveOwnership` as `expectedOwnership` when saving; the save replaces existing shades of the same type, parent, and mode.
- A color ramp is two-step: create the base color with a `var(--name)` reference, then call `generate-color-shades` for `light` and `dark` (typically 4-5 steps each). `transparent` is optional for tint overlays.
- Palette/color deletes require target item ownership. Deleting named CSS-variable
  colors or palettes also requires `allowOrphans: true`; run the reference audit but
  treat its bounded evidence as non-exhaustive.

