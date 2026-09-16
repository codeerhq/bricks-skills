---
name: bricks-custom-dynamic-data-providers
description: "Add or debug custom Bricks dynamic-data tags in a child theme or plugin, including picker registration, rendering and loop context."
---

# Bricks: custom dynamic-data tags

Use public hooks for ordinary custom tags. The internal `Providers::register()` API
takes provider slugs, not instances, and constructs Bricks-namespaced provider
classes. It is not a general third-party registration API.

## Public text-tag recipe

Read [the executable example](assets/custom-text-tag.php) when implementing a simple
post-backed text tag. Adapt its namespace, tag, explicitly public data lookup and
text domain to the project; load the adapted file once from the child theme/plugin.
It deliberately supports one exact text tag, without modifiers or image/link values.

The three rendering paths matter:

- `bricks/dynamic_tags_list` makes a tag discoverable in the picker.
- `bricks/dynamic_data/render_tag` resolves an individual tag; preserve non-string
  results and unrecognized tags from other providers.
- `bricks/dynamic_data/render_content` and `bricks/frontend/render_data` handle tags
  embedded in content. Registering the picker/individual-tag callback alone does
  not implement these paths. Preserve surrounding HTML and unrelated expressions.

The example returns scalar data from individual resolution and escapes its text
replacement at the HTML-content boundary. Consumers of a raw individual value must
escape for their own output context. For image/link/array tags, implement the
specific Bricks value shape and escaping instead of reusing the text substitution.
See [the public custom-tag contract](https://academy.bricksbuilder.io/developer/dynamic-data/create-your-own-dynamic-data-tag/).

## Context and modifiers

Use the post supplied by the renderer. A preview post, page post and loop item are
not interchangeable. For term/user/provider loops, inspect `Bricks\Query`'s actual
loop object/type and define the intended behavior when no applicable context exists.
Do not substitute a guessed post ID or rely on unsupported parser context overrides.

If adding modifiers, parse only the syntax your tag advertises and test malformed,
empty and nested input. Do not rewrite all braces in arbitrary page content. For a
core-style provider integration that really needs `Base`, read
[the internal provider reference](references/internal-provider.md); its lifecycle
and formatting contract are different from public hook callbacks.

Cache expensive lookups using every input that can change the result, including
post/user/locale/arguments as applicable, and invalidate on the corresponding data
updates. Never expose secrets or user-private data through a public rendering tag.

## Verify

Test picker presence, direct tag rendering and a tag inside surrounding text/HTML;
include unrelated tags, non-string values and missing data. Verify the intended
frontend and Builder contexts, plus the actual loop when applicable. A post-only
`preview-dynamic-tag` call cannot certify arbitrary term/user/repeater row context.
The bundled example's isolated PHP test protects its callback behavior; it does not
replace a WordPress/Builder integration check for the adapted provider.
