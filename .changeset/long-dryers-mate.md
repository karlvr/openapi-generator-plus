---
"@openapi-generator-plus/core": patch
---

Fix transformNativeTypeForUsage to transform the nativeType from the schema not the schema usage, to avoid double-transformation
