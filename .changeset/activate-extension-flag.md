---
"@openapi-generator-plus/core": minor
"openapi-generator-plus": minor
---

New `--activate-extension <name>` flag on both `generate` and `bundle` (also `activateExtensions` in the config file). For each name, every `x-{name}-{key}` extension is promoted to `{key}` recursively throughout the spec, replacing any existing value. Useful for keeping target-specific overrides (e.g. `x-server-summary`, `x-client-description`) alongside the default values in a single spec. Repeatable and comma-separated; activations are applied in order, so `--activate-extension server,other` rewrites `x-server-x-other-foo` to `foo`.
