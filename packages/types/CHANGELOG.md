# @openapi-generator-plus/types

## 0.42.0

### Minor Changes

- 4f00292: Improve reuse of schemas to correct issue where duplicate schemas could be generated with the same name

## 0.41.5

### Patch Changes

- 951d0af: Update dependencies

## 0.41.2

### Patch Changes

- 7dc4d1c: Standardise terminology from generator module to generator template

## 0.41.0

### Minor Changes

- f1ca172: Add interfaceCanBeNested() to generator to support Swift, which can't nest protocols
- 25a26cd: Add CodegenHierarchySchema for generators that require special handling of discriminator hierarchies
- eeb0f80: Always create a concrete implementation when we turn an object from the specification into an interface
- a9101dc: Remove defunct FILE type and replace with BINARY type that recognises type string format binary
- 8e27626: Add properties back to CodegenParameterBase so it looks like CodegenSchemaUsage to templates, and add support for deprecated

## 0.40.0

### Minor Changes

- a85452c: Change nativeTypeUsageTransformer to take a CodegenSchemaUsage as that's what we are trying to transform
- 1155800: Decouple CodegenSchemaUsage from CodegenTypeInfo

  This removes duplicated properties about a schema from CodegenSchemaUsage, but means that all generators need
  to reference schema info that isn't customised with usage through the `schema` property.

- 58cb081: Require component for Array and Map schemas
- 4ba6fdd: Remove CodegenTypeInfo and merge into CodegenSchema

  After decoupling it from CodegenSchemaUsage it was no longer relevant, and it represented the proliferation
  of type information that was the original problem.

## 0.39.0

### Minor Changes

- e1af31e: Remove defunct CodegenOperation.returnType
- 32bde64: Allow toLiteral and toDefaultValue to return `null` to signal that a literal or a default value cannot be created for the given type

  For example in Swift sometimes it isn't possible to assign something a default value without making an actual object with actual values.

- f5c140e: Remove CodegenSchemaUsage from CodegenContent and CodegenRequestBody as both may not have a schema

### Patch Changes

- 0b04c82: Change usages of `any` to `unknown` where possible

## 0.38.0

### Minor Changes

- 5d07122: Refactor discriminator type to expose an identifier name and serializedName, and tidy other property naming
- 170bbea: Allow generator to choose whether native compositions wrap non-objectlike members
- 60df9fd: Rename nativeOneOfCanBeScope to nativeCompositionCanBeScope and apply to all native compositions

## 0.36.0

### Minor Changes

- 8cb54fc: Add CodegenGeneratorHelper to allow generators to augment the CodegenDocument
- e4b2f87: Change CodegenSchemaPurpose.MODEL to CodegenSchemaPurpose.GENERAL

## 0.35.0

### Minor Changes

- 1e6716d: Change CodegenDiscriminator to include schema usage info

## 0.34.0

### Minor Changes

- a44b8d4: Add vendor extensions to properties

## 0.33.1

### Patch Changes

- 20fabe0: Add null parents and children to CodegenWrapper to make it easier in templates that are handling object-like things

## 0.33.0

### Minor Changes

- 880828f: Add serializedName to parameters for consistency with properties and convert parameter names to identifiers

  This is consistent with how properties are treated. Generators will need to update to use `serializedName` instead of
  `name` for parameters when serializing in requests.

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
- c7462dd: Support servers on paths and operations

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
