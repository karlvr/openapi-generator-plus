---
"openapi-generator-plus": minor
---

`bundle` command now accepts `-c <config file>` to load `inputPath` (single or array), `outputPath`, filter flags, `activateExtensions`, and `removeExtensions` from a config file. Positional inputs and `-o` on the command line override the config. If the resolved `outputPath` is a directory (or ends with `/`), the bundle is written into it using the basename of the first input.
