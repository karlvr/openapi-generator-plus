---
"openapi-generator-plus": major
"@openapi-generator-plus/core": major
"@openapi-generator-plus/indexed-type": major
"@openapi-generator-plus/testing": major
"@openapi-generator-plus/types": major
---

Refactor support for allOf, anyOf and oneOf so we can accurately represent these concepts in different languages with different capabilities.

Previously we attempted to model these three concepts using objects, inheritance and interface conformance. This sort of worked for Java,
for which these concepts are native. But it didn't work perfectly as Java doesn't support multiple-inheritance so an `allOf` with multiple
refs caused problems, and we lost the idea of compatibility with the refs, as the generator didn't create interfaces.

The previous approach didn't really work for TypeScript, which natively supports types like `A | B | C`, which is pretty good for `anyOf`
and `oneOf`. There's some more commentary about this on https://stackoverflow.com/questions/52836812/how-do-json-schemas-anyof-type-translate-to-typescript
I worked around the TypeScript issues with some gnarly (but less gnarly than this piece of work) post-processing on the `CodegenDocument`
to take advantage of disjunctions for `oneOf`.

Now the generator can indicate what form it supports for each of the composition types, and whether it supports inheritance—single or double.
The core then does the work of creating the right schemas to accurately represent the structure, including creating extra interfaces to ensure
that we accurately represent compatibility between types.

This is all in aid of the first issue:

https://github.com/karlvr/openapi-generator-plus/issues/1
