---
"@openapi-generator-plus/core": minor
"openapi-generator-plus": minor
---

New `--remove-extension <pattern>` flag on the `bundle` command. Each pattern targets vendor extension keys by their suffix (the part after `x-`), with `*` matching any character sequence — for example `--remove-extension server-*` strips every `x-server-*` key from the bundled output. Repeatable and comma-separated, and applied after `--activate-extension`. Backed by a new `removeExtensionsFromOpenAPISpec` export on `@openapi-generator-plus/core`.
