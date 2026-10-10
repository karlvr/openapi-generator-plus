---
"@openapi-generator-plus/core": minor
---

Model `additionalProperties: true` and `additionalProperties: {}` as a map of any values, not a map of strings.

JSON Schema defines both forms to permit a value of any type, so a map of strings could not represent the values that a server sends, such as nested objects. A generator now receives the `any` schema type for the map's values.
