import { CodegenParameterEncoding, CodegenSchema, CodegenSchemaInfo, CodegenSchemaPurpose, CodegenSchemaType, CodegenSchemaUsage, CodegenScope } from '@openapi-generator-plus/types'
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

	/** The parameter encoding in use if purpose === CodegenSchemaPurpose.PARAMETER */
	encoding?: CodegenParameterEncoding
}

export interface SchemaOptions {
	naming: ScopedModelInfo | null
	purpose: CodegenSchemaPurpose

	/** The parameter encoding in use if purpose === CodegenSchemaPurpose.PARAMETER */
	encoding?: CodegenParameterEncoding
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
		encoding: options.encoding,
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
	/* A composition may itself compose a nullable composition, so we fix each in turn, allowing an unwrapped
	   member to be fixed in its own right.
	 */
	let fixedComposition = fixNullableComposition(apiSchema, 'anyOf', $ref, usageInfo, state)
	fixedComposition = fixNullableComposition(fixedComposition.apiSchema, 'oneOf', fixedComposition.$ref, usageInfo, state)
	apiSchema = fixedComposition.apiSchema
	$ref = fixedComposition.$ref

	/* An allOf with a single member that adds no structure of its own is often just a wrapper for the common idiom of
	   attaching sibling attributes such as a description to a $ref (which OpenAPI 3.0 otherwise ignores on a $ref).
	   We unwrap it to that member so it resolves to the referenced schema, with the sibling attributes preserved as
	   attributes of this usage.

	   We only do this when the member cannot be a base to inherit from: a union (oneOf/anyOf) or a leaf (enum,
	   primitive, array). When the member is a concrete object-like schema (an object, map, or another allOf) we
	   leave the allOf in place, as it may legitimately model inheritance from that member (for example a discriminator
	   subclass that adds no properties of its own).

	   The member may itself be a redundant wrapper (such as a nullable oneOf/anyOf, or another single-member allOf), so we
	   reduce it to what it is ultimately equivalent to before making this decision.
	 */
	if (apiSchema.allOf && apiSchema.allOf.length === 1 && !apiSchema.properties && !apiSchema.additionalProperties && !apiSchema.discriminator) {
		const member = apiSchema.allOf[0] as OpenAPIX.SchemaObject
		const reducedMember = reduceRedundantSchema(member, state)
		const reducedMemberType = toCodegenSchemaTypeFromApiSchema(reducedMember.apiSchema)
		if (reducedMemberType !== CodegenSchemaType.OBJECT && reducedMemberType !== CodegenSchemaType.MAP && reducedMemberType !== CodegenSchemaType.ALLOF) {
			const originalApiSchema = apiSchema

			/* As we're unwrapping this redundant allOf we need to also update the $ref to point to our new target schema */
			$ref = reducedMember.$ref
			apiSchema = reducedMember.apiSchema

			if (reducedMember.nullable) {
				usageInfo.nullable = true
			}

			/* Preserve attributes from the original allOf, if present */
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
			if (originalApiSchema.default !== undefined) {
				usageInfo.default = originalApiSchema.default
			}

			/* Note that we fall through to do the rest of the "fixes" */
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

	/* OpenAPI 3.1.0 no longer has the nullable attribute and instead uses a type _array_. A `"null"` member
	   is the nullable idiom, which we turn back into a `nullable` attribute. Any remaining members form a
	   genuine type union, which we model as an `anyOf` of single-type schemas so it flows through the existing
	   composition handling (a single remaining type is simply that type).
	 */
	if (Array.isArray(apiSchema.type) && apiSchema.type.length > 1) {
		if (apiSchema.type.indexOf('null') !== -1) {
			apiSchema.nullable = true
		}

		const otherTypes = apiSchema.type.filter(t => t !== 'null')
		if (otherTypes.length === 1) {
			apiSchema.type = otherTypes[0]
		} else {
			/* Carry the format onto each member so type/format combinations (e.g. an int64 integer or a
			   date-time string) are preserved; each member's type handling uses it where relevant. */
			const format = apiSchema.format
			apiSchema.anyOf = otherTypes.map(t => format !== undefined ? { type: t, format } : { type: t })
			delete apiSchema.type
			delete apiSchema.format
		}
	}

	return { apiSchema, $ref }
}

/** The composition keywords that can express the OpenAPI 3.1 nullable idiom */
type NullableCompositionKeyword = 'anyOf' | 'oneOf'

/**
 * Factor the OpenAPI 3.1 nullable idiom out of the given composition keyword on a schema: a composition with a
 * `"null"` type member is nullable, and composes its remaining members. `oneOf` and `anyOf` are equivalent for this
 * purpose, as a `"null"` member is mutually exclusive with every other member.
 *
 * A composition of a single member and null is redundant, as it is equivalent to that member, so it is unwrapped to
 * that member and the nullability, along with the composition's own attributes, are preserved on the given usage. Any
 * other composition remains a genuine composition of its non-null members, and is marked nullable in its own right.
 *
 * Returns the schema that the given schema is equivalent to, and the `$ref` that points at it, both unchanged if the
 * composition isn't present or doesn't use the idiom.
 */
function fixNullableComposition(apiSchema: OpenAPIX.SchemaObject, keyword: NullableCompositionKeyword, $ref: string | undefined, usageInfo: RememberedCodegenSchemaInfo, state: InternalCodegenState): { apiSchema: OpenAPIX.SchemaObject; $ref: string | undefined } {
	const members = apiSchema[keyword] as OpenAPIX.SchemaObject[] | undefined
	if (!members || members.length <= 1) {
		return { apiSchema, $ref }
	}

	const otherMembers = members.filter(member => member.type !== 'null')
	if (otherMembers.length === members.length) {
		/* The composition doesn't use the nullable idiom */
		return { apiSchema, $ref }
	}

	if (otherMembers.length !== 1) {
		/* The composition has more members, which remain a composition, made nullable */
		apiSchema.nullable = true
		apiSchema[keyword] = otherMembers
		return { apiSchema, $ref }
	}

	const originalApiSchema = apiSchema

	if (isOpenAPIReferenceObject(otherMembers[0])) {
		/* As we're unwrapping this redundant composition we need to also update the $ref to point to our new target schema */
		$ref = otherMembers[0].$ref
	}
	apiSchema = resolveReference(otherMembers[0], state)

	/* Mark this usage as nullable */
	usageInfo.nullable = true

	/* Preserve other attributes from the original composition, if present */
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

	return { apiSchema, $ref }
}

interface ReducedSchema {
	/** The resolved schema that the original is ultimately equivalent to */
	apiSchema: OpenAPIX.SchemaObject
	/** The `$ref` of the reduced schema, if it is a reference */
	$ref: string | undefined
	/** Whether nullability was factored out during reduction (for example from a nullable anyOf) */
	nullable: boolean
}

/**
 * Reduce a schema to the schema it is ultimately equivalent to, looking through references, single-member allOf
 * wrappers, and oneOf/anyOf schemas whose only non-null member is a single schema (the OpenAPI 3.1 nullable idiom).
 * Reduction stops at the first schema that isn't one of these redundant wrappers. The returned `nullable` is true if
 * a null member was factored out along the way.
 */
function reduceRedundantSchema(apiSchema: OpenAPIX.SchemaObject, state: InternalCodegenState, seenRefs: Set<string> = new Set()): ReducedSchema {
	const $ref = isOpenAPIReferenceObject(apiSchema) ? apiSchema.$ref : undefined
	if ($ref) {
		if (seenRefs.has($ref)) {
			/* A circular reference; stop reducing to avoid infinite recursion */
			return { apiSchema: resolveReference(apiSchema, state), $ref, nullable: false }
		}
		seenRefs.add($ref)
	}

	const resolved = resolveReference(apiSchema, state)

	/* A single-member allOf that adds no structure of its own is equivalent to its member */
	if (resolved.allOf && resolved.allOf.length === 1 && !resolved.properties && !resolved.additionalProperties && !resolved.discriminator && !resolved.anyOf && !resolved.oneOf) {
		return reduceRedundantSchema(resolved.allOf[0] as OpenAPIX.SchemaObject, state, seenRefs)
	}

	/* A oneOf or anyOf whose only non-null member is a single schema is equivalent to that member, made nullable */
	const composition = (resolved.anyOf || resolved.oneOf) as OpenAPIX.SchemaObject[] | undefined
	if (composition && composition.length > 1) {
		const nonNullMembers = composition.filter(member => member.type !== 'null')
		if (nonNullMembers.length === 1 && nonNullMembers.length < composition.length) {
			return { ...reduceRedundantSchema(nonNullMembers[0], state, seenRefs), nullable: true }
		}
	}

	return { apiSchema: resolved, $ref, nullable: false }
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
