---
"@openapi-generator-plus/core": patch
---

Re-derive the native type of properties that absorbing makes optional.

An `anyOf` absorbed under the object strategy makes the properties it absorbs
optional, but it left their native type as the one derived while they were
still required. A generator whose `nativeTypeUsageTransformer` depends on
`required` — where optionality is part of the type — then declared a property
it could not leave unset. `allOf` already re-derived the native type when it
makes a property required, so this brings absorbing into line with it.
