---
"openapi-generator-plus": patch
---

Fix `bundle` command to apply tag/path filters before removing extensions, so `--remove-extension` no longer strips `x-tags` (and other filter-relevant extensions) before they can be evaluated.
