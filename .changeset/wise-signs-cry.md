---
"@openapi-generator-plus/core": minor
"openapi-generator-plus": minor
---

Support filtering API specs before bundling or generating. Add `--include-tag`, `--exclude-tag`, `--include-path` and `--exclude-path` flags (repeatable or comma-separated) to the generate and bundle commands, and matching `includeTags` / `excludeTags` / `includePaths` / `excludePaths` keys in config files, to filter the loaded API spec before generation or bundling.
