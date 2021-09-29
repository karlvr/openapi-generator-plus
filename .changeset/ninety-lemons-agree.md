---
"@openapi-generator-plus/core": minor
"@openapi-generator-plus/types": minor
---

Remove CodegenTypeInfo and merge into CodegenSchema

After decoupling it from CodegenSchemaUsage it was no longer relevant, and it represented the proliferation
of type information that was the original problem.
