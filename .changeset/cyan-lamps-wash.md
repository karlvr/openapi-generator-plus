---
"@openapi-generator-plus/core": minor
"@openapi-generator-plus/types": minor
---

Remove the defunct description attribute from CodegenOperationGroup

The description wasn't ever populated, as per the spec, the description on Path Item is
intended to be applied to every operation in the path.

The mapping of path item to operation isn't exact—there could be multiple path items in one
of our groups—so it doesn't make sense for us to have documentation at the operation group level.
