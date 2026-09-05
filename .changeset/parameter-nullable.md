---
"@openapi-generator-plus/core": patch
"@openapi-generator-plus/types": patch
---

Ignore the nullability of a parameter or a header, and warn about it.

A parameter and a header become text in a URL or in a header. That form has no null, and OpenAPI
does not define how to send one. A receiver also cannot tell null from an empty value, so the
nullability cannot survive a round trip. See
https://github.com/OAI/OpenAPI-Specification/issues/1915

`CodegenParameter.nullable` and `CodegenHeader.nullable` were already always `false`, but the
native type still included null. So a template saw a non-nullable parameter with a nullable native
type, and it could not generate correct code for either reading.

The core now removes the nullability from the schema usage, so the native type loses null too, and
it logs a warning that names the parameter or the header. The schema itself keeps its nullability,
because another usage of the same schema can express it. A nullable property is unaffected.
