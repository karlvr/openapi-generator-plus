# @openapi-generator-plus/core

## 2.23.0

### Minor Changes

- 79073bd: Remove `toEnumMemberName` from built-in generator implementation

  I don't think it was sensible to default this to using `toConstantName` as enum member names are actually
  quite significant, especially in Java with its `enum.name()` and `EnumType.valueOf(String)` methods... so I
  think it's better than generator templates handle this specifically.

### Patch Changes

- Updated dependencies [79073bd]
  - @openapi-generator-plus/types@2.19.0
  - @openapi-generator-plus/utils@1.1.4

## 2.22.0

### Minor Changes

- 782c7ab: Ensure `pathParams` are in the order in which they appear in the path

  Having `pathParams` in order makes it more useful as a representation of the path parameters. The order they appear in the path is how I think developers should think about them.

## 2.21.0

### Minor Changes

- 8266830: Support default on a schema usage with a $ref

## 2.20.0

### Minor Changes

- 778ef0c: Introduce CodegenSchemaPurpose.PARENT to better describe why the parent schema is created
- 4474205: Pass purpose through to native type generator functions

### Patch Changes

- Updated dependencies [778ef0c]
- Updated dependencies [4474205]
  - @openapi-generator-plus/types@2.18.0
  - @openapi-generator-plus/utils@1.1.3

## 2.19.0

### Minor Changes

- fe54120: Fix unpopulated `defaultValue` property on CodegenParameter for OAI 3 specs
- a0d868d: Add info to CodegenNativeType to support generators to augment native types as required
- 207ebd5: Add schema scope to generator template's naming callbacks
- 33281d9: Add requiredParams to CodegenOperation
- 41862b9: Add config option for operation grouping strategy
- 343c53e: Try to use an operation group path even when grouping by tag
- 1537b09: Add uniqueName property to CodegenOperation for an identifier that is unique in the entire API (often based on the operationId)
- 70ed015: Add tags to CodegenOperationGroup containing common tags from its operations

### Patch Changes

- 609006e: Fix `allOf` property compatibility checking of inline object properties that have `required` specified on the `allOf` itself
- c3d8509: Add info logging about `allOf` property incompatibility to help explain the generator's choices
- cbd8017: Fix handling of OAI 3.1 nullable schema references using `anyOf`

  The generator did not properly use the referenced schema so it would not be generated as a top-level schema
  and its name would not be used.

- Updated dependencies [a0d868d]
- Updated dependencies [207ebd5]
- Updated dependencies [33281d9]
- Updated dependencies [41862b9]
- Updated dependencies [1537b09]
- Updated dependencies [70ed015]
- Updated dependencies [c130d49]
  - @openapi-generator-plus/types@2.17.0
  - @openapi-generator-plus/utils@1.1.2

## 2.18.0

### Minor Changes

- 9005afb: Add support for arrays without a specified items schema
- 8f4555b: Add support for an ANY schema represented by an empty schema object in OpenAPI

### Patch Changes

- Updated dependencies [8f4555b]
  - @openapi-generator-plus/types@2.16.0
  - @openapi-generator-plus/utils@1.1.1

## 2.17.0

### Minor Changes

- Improve support for schemas created to support different content encodings

### Patch Changes

- Updated dependencies
  - @openapi-generator-plus/types@2.15.0
  - @openapi-generator-plus/utils@1.1.0

## 2.16.0

### Minor Changes

- ac079c7: Introduce FILE schema type for files in a multipart body
- be9830d: Add more CodegenSchemaPurpose values for collection types and rename GENERAL to UNKNOWN
- 6ec95e8: Add purpose as a property in CodegenSchema so we know why schemas were created

### Patch Changes

- f52e0a8: Created arrays should be anonymous
- Maintain additional array metadata such as min and maxItems for new array schemas created due to content-encoding (such as multipart)
- abc2168: Change to use pnpm workspace: uris for monorepo packages
- cfc3835: Fix determination of whether properties override when a property is removed from an interface
- 1fda1b4: Use pnpm 9
- Updated dependencies [ac079c7]
- Updated dependencies [be9830d]
- Updated dependencies [abc2168]
- Updated dependencies [6ec95e8]
  - @openapi-generator-plus/types@2.14.0
  - @openapi-generator-plus/utils@1.0.3

## 2.15.0

### Minor Changes

- 60d019b: Add support for wildcard media types
- 916cd75: Interface and implementation properties should be separate from their source, so we can remove properties from specific schemas
- 9a65a18: Add additional metadata for multipart file properties

### Patch Changes

- fc5f83e: Extract test generator from core
- Updated dependencies [60d019b]
- Updated dependencies [cf1dbe0]
- Updated dependencies [9a65a18]
  - @openapi-generator-plus/types@2.13.0
  - @openapi-generator-plus/utils@1.0.2

## 2.14.1

### Patch Changes

- 8890b9b: Improve spec input path URL detection to not have false positives on Windows

## 2.14.0

### Minor Changes

- 1e4eb38: Fix handling of default response, which should represent all other response codes rather than representing the main response

### Patch Changes

- Updated dependencies [1e4eb38]
  - @openapi-generator-plus/types@2.12.0

## 2.13.0

### Minor Changes

- 2febe2a: Add overrides property to CodegenProperty

### Patch Changes

- Updated dependencies [2febe2a]
  - @openapi-generator-plus/types@2.11.0

## 2.12.1

### Patch Changes

- 5572091: Fix removal of discriminators from parent models

## 2.12.0

### Minor Changes

- 21bac4f: Remove global securityRequirements from CodegenDocument

  And test that the global `security` requirements are applied to operations that don't specify their own security.

- be71953: Detect and warn when a discriminator property is not marked as required
- 5bff6c8: Always remove discriminators from object properties

  Previously when the generator had introduced an _interface_—such as in some `allOf` cases when multiple-inheritance isn't supported (e.g. Java)—the discriminator properties were retained, which resulted in
  inconsistent behaviour.

### Patch Changes

- Updated dependencies [21bac4f]
  - @openapi-generator-plus/types@2.10.0

## 2.11.0

### Minor Changes

- 73f6cf4: Fix collectionFormat handling for OpenAPI v2

### Patch Changes

- Updated dependencies [73f6cf4]
  - @openapi-generator-plus/types@2.9.0

## 2.10.0

### Minor Changes

- 0530715: Support OpenAPI v3.1-style exclusiveMaximum and exclusiveMinimum

### Patch Changes

- 5c4818e: Add list of required properties to AllOfSummary
- f01f197: Ensure we output null rather than undefined even if the API spec contains invalid OAuth flows
- Updated dependencies [5c4818e]
- Updated dependencies [4fdf814]
  - @openapi-generator-plus/types@2.8.1

## 2.9.0

### Minor Changes

- faedb90: Support required on allOf schema
- 31bd79f: Support OpenAPI 3.1.0 style of nullable in type arrays and anyOf with null
- 3b1dec8: Add support for null schema

  A schema type of null is used in OpenAPI 3.1.0 instead of the nullable attribute.

### Patch Changes

- 9320c43: Centralise adding known schemas
- 01c7855: Use Array.isArray rather than typeof === 'object' + a cast
- 61a11d1: Don't "fix" allOf, anyOf and oneOf schemas to have a type of "object"
- edcd1b8: Improve handling of description with a $ref
- 5949a32: Improve error reporting when an unquoted null is used as a type
- Updated dependencies [faedb90]
- Updated dependencies [edcd1b8]
- Updated dependencies [3b1dec8]
  - @openapi-generator-plus/types@2.8.0

## 2.8.1

### Patch Changes

- 23ec19b: Fix missing pluralize dependency
- f9439c6: Import just the required function from lodash
- 700b509: Use import type on openapi-types imports
- 30d6516: Update dependencies
- 01bb97d: Fix response type compile problem with updated openapi-types
- dc4f1b7: Add global options to CodegenConfig
- f082b1a: CodegenOperationGroups should have been an IndexedCollectionType
- Updated dependencies [700b509]
- Updated dependencies [30d6516]
- Updated dependencies [dc4f1b7]
- Updated dependencies [f082b1a]
  - @openapi-generator-plus/types@2.7.1

## 2.8.0

### Minor Changes

- 7cff4eb: Add generator helper method to generate unique schema names

### Patch Changes

- a73e59c: Fix for header schemas that don't specify a type
- 15223fb: Fix hierarchy construction from allOf where there is a chain of inheritance
- Updated dependencies [7cff4eb]
  - @openapi-generator-plus/types@2.7.0

## 2.7.0

### Minor Changes

- 3531f21: When creating a schema name for array or map values, convert the property name to its singular form (in case it's a plural)
- 29717b7: Add general generation options, starting with configuring the requestBody identifier for an operation

### Patch Changes

- Updated dependencies [29717b7]
  - @openapi-generator-plus/types@2.6.0

## 2.6.0

### Minor Changes

- 5fcceaa: Add originalScopedName for schemas
- f1f6b49: Resolve situations where an interface might be implemented by a containing class, which Java doesn't support.

### Patch Changes

- 5adec2c: Nested map schema should be anonymous rather than assuming the name of the object
- aa244ab: Refactor finalising a schema to reflect possibility that naming might change and to detect invalid dupes
- Updated dependencies [5fcceaa]
  - @openapi-generator-plus/types@2.5.0

## 2.5.0

### Minor Changes

- 6b8089f: Wrapper objects should correctly report the underlying API type rather than object

### Patch Changes

- Updated dependencies [6b8089f]
  - @openapi-generator-plus/types@2.4.0

## 2.4.0

### Minor Changes

- 517e703: Wrapper classes should always be scoped to their point of use
- 8eeed1f: Use name from $ref as suggested name for components

### Patch Changes

- ef73d86: A schema might sometimes be added to the wrong scope

## 2.3.3

### Patch Changes

- 2b10a21: Re-release

## 2.3.2

### Patch Changes

- 621b174: Output a warning rather than failing when a schema contains an invalid additionalProperties

## 2.3.1

### Patch Changes

- 81da24d: Improve handling of additionalProperties edge-cases

## 2.3.0

### Minor Changes

- 64cf2e6: Add originalName to CodegenSchema to fix creating suggested names based on names that might have been modified by the generator's toSchemaName

### Patch Changes

- Updated dependencies [64cf2e6]
  - @openapi-generator-plus/types@2.3.0

## 2.2.0

### Minor Changes

- 616b459: Add checkAllOfInheritanceCompatibility to allow generators to perform more detailed checks for allOf inheritance compatibility

### Patch Changes

- Updated dependencies [616b459]
  - @openapi-generator-plus/types@2.2.0

## 2.1.0

### Minor Changes

- 6d88944: Reimplement initialValue as it is important for generators

### Patch Changes

- Updated dependencies [6d88944]
  - @openapi-generator-plus/types@2.1.0

## 2.0.0

### Major Changes

- fb1ae88: Change the default vs initial value approach by removing `initialValue` from `CodegenProperty`, replacing it with `defaultValue`, and only populating it if a default is specified in the schema.

  The `initialValue` function in `CodegenGenerator` has been removed. Previously the `initialValue` function would return a value to use if there wasn't a default in the schema, leading to default values in the generated code where no default was expected.

### Patch Changes

- Updated dependencies [fb1ae88]
  - @openapi-generator-plus/types@2.0.0
  - @openapi-generator-plus/utils@1.0.1

## 1.6.0

### Minor Changes

- 43092cb: Separate externally usable utility functions into @openapi-generator-plus/utils

### Patch Changes

- c88af7b: Upgrade dependencies
- Updated dependencies [c88af7b]
  - @openapi-generator-plus/types@1.4.1

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
