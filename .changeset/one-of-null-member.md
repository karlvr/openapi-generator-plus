---
"@openapi-generator-plus/core": minor
---

Support OpenAPI 3.1 nullable idiom in `oneOf`

A `oneOf` containing a `"null"` type member is now factored into a nullable schema of its remaining
members, as an `anyOf` already was. `oneOf` and `anyOf` are equivalent here, as a `"null"` member is
mutually exclusive with every other member.

A `oneOf` of a single member and `"null"` is unwrapped to that member, made nullable, preserving the
attributes declared alongside the `oneOf`. Previously it produced a two member union, which generators
turned into a union type with a member wrapping the null value, which could be unusable at runtime.
A `oneOf` with more members remains a union of those members, made nullable, and keeps its
discriminator.
