import { CodegenSchema, CodegenSchemaInfo, CodegenSchemaPurpose, CodegenSchemaType, CodegenSchemaUsage, CodegenScope } from '@openapi-generator-plus/types'
import type { OpenAPIV2, OpenAPIV3 } from 'openapi-types'
import { debugStringify } from '@openapi-generator-plus/utils'
import { isOpenAPIReferenceObject, isOpenAPIV2Document } from '../../openapi-type-guards'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { toCodegenExamples } from '../examples'
import { toCodegenExternalDocs } from '../external-docs'
import { extractCodegenSchemaInfo, nameFromRef, resolveReference, toDefaultValue } from '../utils'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { toCodegenAllOfSchema } from './all-of'
import { toCodegenAnyOfSchema } from './any-of'
import { toCodegenArraySchema } from './array'
import { toCodegenBooleanSchema } from './boolean'
import { toCodegenEnumSchema } from './enum'
import { toCodegenMapSchema } from './map'
import { toUniqueScopedName, extractNaming, usedSchemaName, ScopedModelInfo } from './naming'
import { toCodegenNumericSchema } from './numeric'
import { toCodegenObjectSchema } from './object'
import { toCodegenOneOfSchema } from './one-of'
import { toCodegenSchemaType, toCodegenSchemaTypeFromApiSchema } from './schema-type'
import { toCodegenStringSchema } from './string'
import { transformNativeTypeForUsage } from './usage'
import { addReservedSchemaName, addToKnownSchemas, extractCodegenSchemaCommon, finaliseSchema, findKnownSchema, refForPathAndSchemaName, refForSchemaName } from './utils'
import { singular } from 'pluralize'
import { toCodegenNullSchema } from './null'
import { toCodegenAnySchema } from './any'

export function discoverCodegenSchemas(specSchemas: OpenAPIV2.DefinitionsObject | Record<string, OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject>, state: InternalCodegenState): void {
	/* Collect defined schema names first, so no inline or external schemas can use those names */
	for (const schemaName in specSchemas) {
		usedSchemaName([schemaName], state)
		addReservedSchemaName(schemaName, state)
	}

	for (const schemaName in specSchemas) {
		/* We load the schema using a reference as we use references to distinguish between explicit and inline models */
		const reference: OpenAPIX.ReferenceObject = {
			$ref: refForSchemaName(schemaName, state),
		}

		toCodegenSchemaUsage(reference, state, {
			required: true, 
			suggestedName: schemaName,
			purpose: CodegenSchemaPurpose.UNKNOWN,
			suggestedScope: null,
		})
	}
}

export interface SchemaUsageOptions {
	required: boolean
	suggestedName: string | ((type: CodegenSchemaType) => string)
	/**
	 * The purpose for which this schema is being used in the context requesting the creation of the `CodegenSchemaUsage`.
	 */
	purpose: CodegenSchemaPurpose
	suggestedScope: CodegenScope | null
}

export interface SchemaOptions {
	naming: ScopedModelInfo | null
	purpose: CodegenSchemaPurpose
}

export interface SchemaOptionsRequiredNaming extends SchemaOptions {
	naming: ScopedModelInfo
}

type RememberedCodegenSchemaInfo = Partial<CodegenSchemaInfo> & { default?: unknown }

export function toCodegenSchemaUsage(apiSchema: OpenAPIX.SchemaObject | OpenAPIX.ReferenceObject, state: InternalCodegenState, options: SchemaUsageOptions): CodegenSchemaUsage {
	let $ref = isOpenAPIReferenceObject(apiSchema) ? apiSchema.$ref : undefined

	const usageInfo: RememberedCodegenSchemaInfo = {}

	if (isOpenAPIReferenceObject(apiSchema)) {
		/* A reference schema (one containing a $ref) may specify some properties that effect the usage of that schema */
		const originalApiSchemaAsSchemaObject: OpenAPIX.SchemaObject = apiSchema

		usageInfo.description = originalApiSchemaAsSchemaObject.description
		usageInfo.nullable = originalApiSchemaAsSchemaObject.nullable
		usageInfo.readOnly = originalApiSchemaAsSchemaObject.readOnly
		usageInfo.writeOnly = originalApiSchemaAsSchemaObject.writeOnly
		usageInfo.deprecated = originalApiSchemaAsSchemaObject.deprecated
		usageInfo.default = originalApiSchemaAsSchemaObject.default
	}

	apiSchema = resolveReference(apiSchema, state)
	const fixed = fixApiSchema(apiSchema, $ref, usageInfo, state)
	apiSchema = fixed.apiSchema
	$ref = fixed.$ref

	/* Check if we've already generated this schema, and return it */
	const existing = findKnownSchema(apiSchema, $ref, state)
	let schemaObject: CodegenSchema
	if (existing) {
		schemaObject = existing
	} else {
		schemaObject = toCodegenSchema(apiSchema, $ref, options, state)

		const dedupe = addToKnownSchemas(apiSchema, schemaObject, $ref, state)
		if (dedupe !== schemaObject) {
			/* If we know that we might need to use an already created schema we should have called addToKnownSchemas before finalising the schema */
			throw new Error(`Created schema that is already known: ${debugStringify(schemaObject)}`)
		}
	}

	const result: CodegenSchemaUsage = {
		...extractCodegenSchemaInfo(schemaObject),
		required: options.required,
		schema: schemaObject,
		examples: null,
		defaultValue: null,
	}

	if (usageInfo.description) {
		result.description = usageInfo.description
	}
	if (usageInfo.nullable) {
		result.nullable = true
	}
	if (usageInfo.readOnly) {
		result.readOnly = true
	}
	if (usageInfo.writeOnly) {
		result.writeOnly = true
	}
	if (usageInfo.deprecated) {
		result.deprecated = true
	}

	/* Apply the schema usage to the native type */
	result.nativeType = transformNativeTypeForUsage(result, state)

	result.examples = apiSchema.example ? toCodegenExamples(apiSchema.example, undefined, undefined, result, state) : null
	if (usageInfo.default) {
		result.defaultValue = toDefaultValue(usageInfo.default, result, state)
	} else {
		result.defaultValue = toDefaultValue(apiSchema.default, result, state)
	}

	return result
}

function toCodegenSchema(apiSchema: OpenAPIX.SchemaObject, $ref: string | undefined, options: SchemaUsageOptions, state: InternalCodegenState): CodegenSchema {
	const schemaType = toCodegenSchemaTypeFromApiSchema(apiSchema)

	const { purpose, suggestedScope } = options
	let { suggestedName } = options

	if (typeof suggestedName === 'function') {
		suggestedName = suggestedName(schemaType)
	}
	
	/* Use purpose to refine the suggested name */
	suggestedName = state.generator.toSuggestedSchemaName(suggestedName, {
		purpose,
		schemaType,
		scope: suggestedScope,
	})

	const naming = supportedNamedSchema(schemaType, !!$ref, purpose, state) ? toUniqueScopedName($ref, suggestedName, suggestedScope, apiSchema, schemaType, purpose, state) : null
	if (naming) {
		usedSchemaName(naming.scopedName, state)
	} else if ($ref) {
		/* If we're not creating naming for this schema, but there's a $ref then we can update the suggestedName to take advantage of that naming from the spec for component naming */
		suggestedName = nameFromRef($ref, state)
	}

	/* Due to the recursive nature of nameFromRef, we might have actually generated a schema for us now! */
	const existingNow = findKnownSchema(apiSchema, $ref, state)
	if (existingNow) {
		return existingNow
	}

	const schemaOptions: SchemaOptions = {
		naming,
		purpose,
	}
	
	let result: CodegenSchema
	switch (schemaType) {
		case CodegenSchemaType.MAP:
			result = toCodegenMapSchema(apiSchema, {
				...schemaOptions,
				suggestedValueModelName: naming ? 'value' : singular(suggestedName),
				suggestedValueModelScope: naming ? naming.scope : suggestedScope,
			}, state)
			break
		case CodegenSchemaType.OBJECT:
			if (!naming) {
				// naming = toUniqueScopedName($ref, suggestedName, suggestedScope, schema, state)
				throw new Error(`no name for ${debugStringify(apiSchema)}`)
			}
			result = toCodegenObjectSchema(apiSchema, {
				...schemaOptions,
				naming,
			}, state)
			break
		case CodegenSchemaType.INTERFACE:
			throw new Error(`Cannot create an interface directly from an OpenAPI schema: ${debugStringify(apiSchema)}`)
		case CodegenSchemaType.WRAPPER:
			throw new Error(`Cannot create a wrapper directly from an OpenAPI schema: ${debugStringify(apiSchema)}`)
		case CodegenSchemaType.HIERARCHY:
			throw new Error(`Cannot create a hierarchy directly from an OpenAPI schema: ${debugStringify(apiSchema)}`)
		case CodegenSchemaType.ALLOF:
			if (!naming) {
				throw new Error(`no name for ${debugStringify(apiSchema)}`)
			}
			result = toCodegenAllOfSchema(apiSchema, {
				...schemaOptions,
				naming,
			}, state)
			break
		case CodegenSchemaType.ANYOF:
			if (!naming) {
				throw new Error(`no name for ${debugStringify(apiSchema)}`)
			}
			result = toCodegenAnyOfSchema(apiSchema, {
				...schemaOptions,
				naming,
			}, state)
			break
		case CodegenSchemaType.ONEOF:
			if (!naming) {
				throw new Error(`no name for ${debugStringify(apiSchema)}`)
			}
			result = toCodegenOneOfSchema(apiSchema, {
				...schemaOptions,
				naming,
			}, state)
			break
		case CodegenSchemaType.ARRAY:
			result = toCodegenArraySchema(apiSchema, {
				...schemaOptions,
				suggestedItemModelName: naming ? 'item' : singular(suggestedName), 
				suggestedItemModelScope: naming ? naming.scope : suggestedScope,
			}, state)
			break
		case CodegenSchemaType.ENUM:
			result = toCodegenEnumSchema(apiSchema, schemaOptions, state)
			break
		case CodegenSchemaType.NUMBER:
		case CodegenSchemaType.INTEGER:
			result = toCodegenNumericSchema(apiSchema, schemaOptions, state)
			break
		case CodegenSchemaType.STRING:
			result = toCodegenStringSchema(apiSchema, schemaOptions, state)
			break
		case CodegenSchemaType.BOOLEAN:
			result = toCodegenBooleanSchema(apiSchema, schemaOptions, state)
			break
		case CodegenSchemaType.DATE:
		case CodegenSchemaType.DATETIME:
		case CodegenSchemaType.TIME:
		case CodegenSchemaType.BINARY:
		case CodegenSchemaType.FILE: {
			if (typeof apiSchema.type !== 'string') {
				throw new Error(`Unsupported schema type "${apiSchema.type}" for property in ${debugStringify(apiSchema)}`)
			}

			/* Generic unsupported schema support */
			const type = apiSchema.type
			const format: string | undefined = apiSchema.format
			const vendorExtensions = toCodegenVendorExtensions(apiSchema)

			const nativeType = state.generator.toNativeType({
				type,
				format,
				purpose,
				schemaType,
				vendorExtensions,
			})

			result = {
				...extractNaming(naming),
				type,
				format: format || null,
				purpose,
				schemaType: toCodegenSchemaType(type, format),
				contentMediaType: null,
				nativeType,
				component: null,

				vendorExtensions,
				externalDocs: toCodegenExternalDocs(apiSchema),

				...extractCodegenSchemaCommon(apiSchema, state),
			}

			finaliseSchema(result, naming, state)
			break
		}
		case CodegenSchemaType.NULL: {
			result = toCodegenNullSchema(apiSchema, schemaOptions, state)
			break
		}
		case CodegenSchemaType.ANY: {
			result = toCodegenAnySchema(apiSchema, schemaOptions, state)
			break
		}
	}
	return result
}

// TODO this will be customised by the generator
function supportedNamedSchema(schemaType: CodegenSchemaType, referenced: boolean, purpose: CodegenSchemaPurpose, state: InternalCodegenState): boolean {
	if (
		schemaType === CodegenSchemaType.OBJECT ||
		schemaType === CodegenSchemaType.ENUM ||
		schemaType === CodegenSchemaType.ALLOF ||
		schemaType === CodegenSchemaType.ANYOF ||
		schemaType === CodegenSchemaType.ONEOF
	) {
		return true
	}

	return false
}

/**
 * Sometimes a schema omits the `type`, even though the specification states that it must be a `string`.
 * This method corrects for those cases where we can determine what the schema _should_ be.
 * <p>
 * NOTE: It is critical that this method DOES NOT modify the original parsed schema IF we make changes to the usageInfo
 * that would not be repeated if we see that modified schema again, because in that case the subsequent uses would get the
 * fixed schema but NOT the fixed usageInfo.
 * @param apiSchema 
 */
function fixApiSchema(apiSchema: OpenAPIX.SchemaObject, $ref: string | undefined, usageInfo: RememberedCodegenSchemaInfo, state: InternalCodegenState): { apiSchema: OpenAPIX.SchemaObject; $ref: string | undefined } {
	if (apiSchema.anyOf && apiSchema.anyOf.length > 1) {
		const nullIndex = (apiSchema.anyOf as OpenAPIX.SchemaObject[]).findIndex(s => s.type === 'null')
		if (nullIndex !== -1) {
			const otherTypes = (apiSchema.anyOf as OpenAPIX.SchemaObject[]).filter(s => s.type !== 'null')
			if (otherTypes.length === 1) {
				/* An anyOf that was a single type + null gets turned back into that single type, but with a "nullable" attribute
				 * on this usage.
				 */
				const originalApiSchema = apiSchema
				
				if (isOpenAPIReferenceObject(otherTypes[0])) {
					/* As we're unwrapping this redundant anyOf we need to also update the $ref to point to our new target schema */
					$ref = otherTypes[0].$ref
				}
				apiSchema = resolveReference(otherTypes[0], state)

				/* Mark this usage as nullable */
				usageInfo.nullable = true

				/* Preserve other attributes from the original anyOf, if present */
				if (originalApiSchema.description) {
					usageInfo.description = originalApiSchema.description
				}
				if (originalApiSchema.readOnly) {
					usageInfo.readOnly = originalApiSchema.readOnly
				}
				if (originalApiSchema.writeOnly) {
					usageInfo.writeOnly = originalApiSchema.writeOnly
				}
				if (originalApiSchema.deprecated) {
					usageInfo.deprecated = originalApiSchema.deprecated
				}
				if (originalApiSchema.default) {
					usageInfo.default = originalApiSchema.default
				}

				/* Note that we fall through to do the rest of the "fixes" */
			} else {
				/* The anyOf has more members */
				apiSchema.nullable = true
				apiSchema.anyOf = otherTypes
			}
		}
	}

	if (apiSchema.type === undefined && !apiSchema.allOf && !apiSchema.anyOf && !apiSchema.oneOf) {
		if (apiSchema.required || apiSchema.properties || apiSchema.additionalProperties) {
			apiSchema.type = 'object'
		} else if (apiSchema.enum) {
			apiSchema.type = 'string'
		}
	}

	/* Some specs have the enum declared at the array level, rather than the items. The Vimeo API schema is an example.
	   https://raw.githubusercontent.com/vimeo/openapi/master/api.yaml
	*/
	if (apiSchema.type === 'array' && apiSchema.enum) {
		if (apiSchema.items) {
			const items = resolveReference(apiSchema.items, state)
			if (!items.enum) {
				items.enum = apiSchema.enum
				apiSchema.enum = undefined
			}
		}
	}

	/* OpenAPI 3.1.0 no longer has the nullable attribute and instead uses a type _array_ with a "null" type.
	   We change that here to be a nullable attribute instead.
	 */
	if (Array.isArray(apiSchema.type) && apiSchema.type.length > 1) {
		const nullIndex = apiSchema.type.indexOf('null')
		if (nullIndex !== -1) {
			apiSchema.nullable = true

			const otherTypes = apiSchema.type.filter(t => t !== 'null')
			if (otherTypes.length === 1) {
				apiSchema.type = otherTypes[0]
			} else {
				apiSchema.type = otherTypes
			}
		}
	}

	return { apiSchema, $ref }
}

export type DiscoverSchemasTestFunc = (apiSchema: OpenAPIX.SchemaObject, state: InternalCodegenState) => boolean

/**
 * Discover schemas that match a test function that exist in documents that are referenced by our root document, but
 * which are not in our root document.
 * @param testFunc 
 * @param state 
 */
export function discoverSchemasInOtherDocuments(testFunc: DiscoverSchemasTestFunc, state: InternalCodegenState): CodegenSchemaUsage[] {
	const paths = state.$refs.paths()
	const values = state.$refs.values()

	const result: CodegenSchemaUsage[] = []

	for (const path of paths) {
		const doc = values[path]
		if (doc === state.root) {
			/* Skip the root doc, as we're looking for schemas we haven't already discovered */
			continue
		}

		const specSchemas = (isOpenAPIV2Document(doc) ? doc.definitions : doc.components?.schemas) || {}
		for (const schemaName in specSchemas) {
			const anApiSchema = resolveReference(specSchemas[schemaName], state) as OpenAPIX.SchemaObject
			if (testFunc(anApiSchema, state)) {
				/* We load the schema using a reference as we use references to distinguish between explicit and inline models */
				const reference: OpenAPIX.ReferenceObject = {
					$ref: refForPathAndSchemaName(path, doc, schemaName, state),
				}
		
				const discovered = toCodegenSchemaUsage(reference, state, {
					required: true, 
					suggestedName: schemaName,
					purpose: CodegenSchemaPurpose.UNKNOWN,
					suggestedScope: null,
				})
				result.push(discovered)
			}
		}
	}

	return result
}
