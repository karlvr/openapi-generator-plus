---
"@openapi-generator-plus/core": minor
"@openapi-generator-plus/types": minor
---

Allow toLiteral and toDefaultValue to return `null` to signal that a literal or a default value cannot be created for the given type

For example in Swift sometimes it isn't possible to assign something a default value without making an actual object with actual values.
