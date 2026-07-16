---
"@openapi-generator-plus/core": minor
---

Don't implement `anyOf` member interfaces when members share a property with incompatible types

When an anyOf's object strategy absorbs its members into a single object, it now only makes that
object implement the members' interfaces if the members' shared properties are mutually compatible.
Previously a property that was, for example, nullable in one member but not another could produce a
class that could not satisfy all of the member interfaces.
