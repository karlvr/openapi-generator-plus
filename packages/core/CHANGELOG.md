# @openapi-generator-plus/core

## 0.32.0

### Minor Changes

- 9873f9b: Add support for parameter encoding styles
- f164605: Remove the defunct description attribute from CodegenOperationGroup

  The description wasn't ever populated, as per the spec, the description on Path Item is
  intended to be applied to every operation in the path.

  The mapping of path item to operation isn't exact—there could be multiple path items in one
  of our groups—so it doesn't make sense for us to have documentation at the operation group level.

- 609f283: Add explicit polymorphic property to schema

  So we can tell whether an object structure is intended to be polymorphic when
  we've converted it from `oneOf` etc to objects.

- d821e84: Add support for externalDocs on operations and schemas
- 8d91265: Handle boolean values of 'yes' and 'no' correctly
- c7462dd: Support servers on paths and operations

### Patch Changes

- e48312f: `allOf`: change suggested name for inline models in native mode

  The previous suggested name appended "parent", which didn't make sense, as when we're using a native `allOf` it's not a parent relationship.
  I chose "content" as it's the _content_ of the `allOf` schema?

  Maybe these anonymous schemas aren't such a good idea, and we should instead allow an `allOf` to have an inline schema, or its own properties.
  Maybe that's another generator option; allow inline schemas on an `allOf`, or generate a model to contain them.

- d8e932d: Fix an incorrect schema type used for date etc string types

  They were treated as files!

## 0.31.3

### Patch Changes

- baee363: Don't implement the interface if we extend its implementation (which itself implements the interface)

## 0.31.2

### Patch Changes

- ec79fab: Fix using an interface's implementation as a parent in an allOf

  We still absorbed the interface's properties, so we ended up duplicating the properties in
  our object schema, and in our parent object schema.

  This caused an issue in the Java generator as the bean validation annotations that we use
  are not allowed to appear twice on the same property in an inheritance hierarchy.

## 0.31.1

### Patch Changes

- Fix broken build process that included incorrect relative dependencies

## 0.31.0

### Minor Changes

- 5f7c37f: Refactor support for allOf, anyOf and oneOf so we can accurately represent these concepts in different languages with different capabilities.

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
