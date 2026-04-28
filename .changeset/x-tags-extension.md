---
"@openapi-generator-plus/core": minor
"openapi-generator-plus": minor
---

Tag filtering now honours an `x-tags` extension on parameters, schema properties, request bodies, response codes, and media-type variants. When `--include-tag`/`--exclude-tag` is active, `x-tags` are additive to the enclosing operation's tags and let you filter inside an operation: drop a property (also removed from `required`), drop a single media-type variant, drop a response code, etc. `x-tags` on shared `components`/`definitions` are evaluated without an operation context and apply to the shared entry itself. The extension accepts either an array of strings or a single string.
