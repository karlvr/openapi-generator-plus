---
"@openapi-generator-plus/core": minor
"@openapi-generator-plus/types": minor
---

Add serializedName to parameters for consistency with properties and convert parameter names to identifiers

This is consistent with how properties are treated. Generators will need to update to use `serializedName` instead of
`name` for parameters when serializing in requests.
