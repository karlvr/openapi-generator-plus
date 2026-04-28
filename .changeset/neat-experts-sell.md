---
"@openapi-generator-plus/core": minor
"openapi-generator-plus": minor
---

`bundle` command now accepts multiple input specs and merges them into a single document. Last-wins on collisions (paths, components/definitions, tags) with a warning printed for each. Top-level metadata is taken from the first spec; mixing OpenAPI v2 and v3 inputs is rejected. Filters apply after merging.
