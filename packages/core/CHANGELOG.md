# @openapi-generator-plus/core

## 1.5.1

### Patch Changes

- 054d48d: Fix double application of toSchemaName when creating an interface implementation

## 1.5.0

### Minor Changes

- 280dd6c: Add a suffix to wrapper schema names
- 5340088: Use serializedName as the basis for suggested names as it is the original name from the spec rather than a name that may have been modified by toSchemaName

### Patch Changes

- e2cf466: Add a test for oneOfs that are anonymous

## 1.4.0

### Minor Changes

- ee74aa9: Discover external schemas that are members of an external discriminator [#36]

## 1.3.0

### Minor Changes

- d248bef: Don't generate inheritance or interface comformance when allOf schemas are incompatible

### Patch Changes

- e189df5: Don't generate inheritance or interface comformance when allOf schemas are incompatible

## 1.1.0

### Minor Changes

- a047d06: Support required and deprecated on a \$ref to a parameter
- 7e8d6c9: Add support for loading specs from a URL
- 1feb878: Ignore enum specified on a boolean property

## 1.0.0

### Major Changes

- First major release

### Minor Changes

- d7f6d83: Add support for allowEmptyValue on parameters

### Patch Changes

- Updated dependencies
  - @openapi-generator-plus/indexed-type@1.0.0

## 0.42.0

### Minor Changes

- 1ca4910: Fix reserved schemas when there are multiple documents referenced in a spec
- 4f00292: Improve reuse of schemas to correct issue where duplicate schemas could be generated with the same name
- 3b72edb: Support an allOf member that contains additionalProperties, whether inline or not
- f2fbd04: Support an allOf member that is determined to be a Map because it is an object with additionalProperties and no properties
- 6872a0c: Make `uniquePropertiesIncludingInherited` function usable by generators, and add `uniquePropertiesIncludingInheritedForParents` function

### Patch Changes

- 5e15b3a: Fix findPropertyAndSchema methods searching of parents
- 5f754a2: Wrapper should be able to contain nullable values
- 65accd3: Fix removal of property for discriminators to only remove if it's not required by an interface

## 0.41.5

### Patch Changes

- 951d0af: Update dependencies

## 0.41.4

### Patch Changes

- 1291c63: Fix finding discriminators in allOf hierarchies

## 0.41.3

### Patch Changes

- 38e33c3: Fix native allOf to support an allOf that references another allOf

## 0.41.2

### Patch Changes

- 7dc4d1c: Standardise terminology from generator module to generator template

## 0.41.0

### Minor Changes

- f1ca172: Add interfaceCanBeNested() to generator to support Swift, which can't nest protocols
- 25a26cd: Add CodegenHierarchySchema for generators that require special handling of discriminator hierarchies
- 14c54ae: Artificially created properties now get an appropriate initial value
- eeb0f80: Always create a concrete implementation when we turn an object from the specification into an interface
- 68b1c65: Add debugStringify to improve logging of objects
- 1969730: Fix initial value on artificially created part properties for multipart forms
- a9101dc: Remove defunct FILE type and replace with BINARY type that recognises type string format binary
- 8e27626: Add properties back to CodegenParameterBase so it looks like CodegenSchemaUsage to templates, and add support for deprecated

### Patch Changes

- d4a0d98: Support references in examples
- 5c9b32d: Fix transformNativeTypeForUsage to transform the nativeType from the schema not the schema usage, to avoid double-transformation
- 51b10a5: Fix transforming of component types
- 1f5efef: Fix creation of interface implementations when inheritance isn't supported
- 8ce82be: Fix forced required on path parameters

## 0.40.0

### Minor Changes

- 1155800: Decouple CodegenSchemaUsage from CodegenTypeInfo

  This removes duplicated properties about a schema from CodegenSchemaUsage, but means that all generators need
  to reference schema info that isn't customised with usage through the `schema` property.

- 79f4729: Improve generated schema names in compositions

  Previously improved in f04e527 and improved again here

- 4ba6fdd: Remove CodegenTypeInfo and merge into CodegenSchema

  After decoupling it from CodegenSchemaUsage it was no longer relevant, and it represented the proliferation
  of type information that was the original problem.

## 0.39.0

### Minor Changes

- e1af31e: Remove defunct CodegenOperation.returnType
- 32bde64: Allow toLiteral and toDefaultValue to return `null` to signal that a literal or a default value cannot be created for the given type

  For example in Swift sometimes it isn't possible to assign something a default value without making an actual object with actual values.

- f5c140e: Remove CodegenSchemaUsage from CodegenContent and CodegenRequestBody as both may not have a schema
- 5ccf71c: Don't use console.warn for generator warnings as it outputs a stack trace in our tests

### Patch Changes

- 2c4c175: Fix missing transform of native type when creating a custom schema usage such as when generating artificial schema and properties
- 0b04c82: Change usages of `any` to `unknown` where possible
- 4499766: Fix infinite loop when resolving duplicate operation names

## 0.38.0

### Minor Changes

- 280aa4e: Schemas used in a native allOf, oneOf or allOf can now be required to have a name by the generator.

  As we sometimes want to have a name to refer to the composed schemas.

- f04e527: Improve suggested names on composed schemas
- 6bfe5cd: Wrapper value properties should be required
- 5d07122: Refactor discriminator type to expose an identifier name and serializedName, and tidy other property naming
- 170bbea: Allow generator to choose whether native compositions wrap non-objectlike members
- 60df9fd: Rename nativeOneOfCanBeScope to nativeCompositionCanBeScope and apply to all native compositions

## 0.37.0

### Minor Changes

- 8d801d7: If all subschemas are removed during post-processing, ensure we null the subschemas so generators treat the situation correctly
- 8cb54fc: Add CodegenGeneratorHelper to allow generators to augment the CodegenDocument
- e4b2f87: Change CodegenSchemaPurpose.MODEL to CodegenSchemaPurpose.GENERAL

## 0.36.0

### Minor Changes

- 1e6716d: Change CodegenDiscriminator to include schema usage info
- 80f85ae: Create native allOf's inline models as nested schemas rather than global schemas

## 0.35.0

### Minor Changes

- a44b8d4: Add vendor extensions to properties

## 0.34.1

### Patch Changes

- 20fabe0: Add null parents and children to CodegenWrapper to make it easier in templates that are handling object-like things

## 0.34.0

### Minor Changes

- 7c0d70c: allOf to object algorithm will create an inheritance hierarchy with a member that has a discriminator if possible

### Patch Changes

- 7a7b42c: Refactor by creating methods to manage parent/child, implementors/implements

  This also uncovered one missing side of those relationships in toCodegenInterfaceImplementationSchema

- b465b1c: Refactor: tidy parameter naming to better differentiate between api spec schemas and our own schemas

## 0.33.1

### Patch Changes

- 79eca1f: Fix handling of numbers in a spec that might be 0

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
