---
"@openapi-generator-plus/core": patch
---

`allOf`: change suggested name for inline models in native mode

The previous suggested name appended "parent", which didn't make sense, as when we're using a native `allOf` it's not a parent relationship.
I chose "content" as it's the _content_ of the `allOf` schema?

Maybe these anonymous schemas aren't such a good idea, and we should instead allow an `allOf` to have an inline schema, or its own properties.
Maybe that's another generator option; allow inline schemas on an `allOf`, or generate a model to contain them.
