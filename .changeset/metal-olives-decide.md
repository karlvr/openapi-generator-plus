---
"@openapi-generator-plus/types": minor
"@openapi-generator-plus/core": minor
---

Remove `toEnumMemberName` from built-in generator implementation

I don't think it was sensible to default this to using `toConstantName` as enum member names are actually
quite significant, especially in Java with its `enum.name()` and `EnumType.valueOf(String)` methods... so I
think it's better than generator templates handle this specifically.
