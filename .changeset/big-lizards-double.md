---
"@openapi-generator-plus/core": minor
"@openapi-generator-plus/types": minor
---

Decouple CodegenSchemaUsage from CodegenTypeInfo

This removes duplicated properties about a schema from CodegenSchemaUsage, but means that all generators need
to reference schema info that isn't customised with usage through the `schema` property.
