---
"openapi-generator-plus": minor
---

`generate` command now accepts multiple input specs (positional args or `inputPath` array in the config file) and merges them using the same last-wins semantics as `bundle` before generating code.
