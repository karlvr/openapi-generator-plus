import { CodegenSchema, CodegenSchemaPurpose, CodegenSchemaType, CodegenSchemaUsage, CodegenScope } from '@openapi-generator-plus/types'
import { OpenAPIV2, OpenAPIV3 } from 'openapi-types'
import { CodegenFullTransformingNativeTypeImpl, CodegenTransformingNativeTypeImpl } from '../../native-type'
import { isOpenAPIReferenceObject, isOpenAPIV2Document } from '../../openapi-type-guards'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { toCodegenExamples } from '../examples'
import { extractCodegenSchemaInfo, resolveReference } from '../utils'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { toCodegenAllOfSchema } from './all-of'
import { toCodegenAnyOfSchema } from './any-of'
import { toCodegenArraySchema } from './array'
import { toCodegenBooleanSchema } from './boolean'
import { toCodegenEnumSchema } from './enum'
import { toCodegenMapSchema } from './map'
import { fullyQualifiedName, toUniqueScopedName, extractNaming, usedSchemaName } from './naming'
import { toCodegenNumericSchema } from './numeric'
import { toCodegenObjectSchema } from './object'
import { toCodegenOneOfSchema } from './one-of'
import { toCodegenSchemaType, toCodegenSchemaTypeFromSchema } from './schema-type'
import { toCodegenStringSchema } from './string'
import { addToKnownSchemas, addToScope, extractCodegenSchemaCommon } from './utils'

export function discoverCodegenSchemas(specSchemas: OpenAPIV2.DefinitionsObject | Record<string, OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject>, state: InternalCodegenState): void {
	/* Collect defined schema names first, so no inline or external schemas can use those names */
	for (const schemaName in specSchemas) {
		const fqn = fullyQualifiedName([schemaName])
		usedSchemaName([schemaName], state)
		state.reservedSchemaNames[refForSchemaName(schemaName, state)] = fqn
	}

	for (const schemaName in specSchemas) {
		/* We load the model using a reference as we use references to distinguish between explicit and inline models */
		const reference: OpenAPIX.ReferenceObject = {
			$ref: refForSchemaName(schemaName, state),
		}

		toCodegenSchemaUsage(reference, state, {
			required: true, 
			suggestedName: schemaName,
			purpose: CodegenSchemaPurpose.MODEL,
			scope: null,
		})
	}
}

/**
 * Returns the value of the `$ref` to use to refer to the given schema definition / component.
 * @param schemaName the name of a schema
 * @param state 
 */
function refForSchemaName(schemaName: string, state: InternalCodegenState): string {
	return isOpenAPIV2Document(state.root) ? `#/definitions/${schemaName}` : `#/components/schemas/${schemaName}`
}

export interface SchemaUsageOptions {
	required: boolean
	suggestedName: string
	purpose: CodegenSchemaPurpose
	scope: CodegenScope | null
}

export function toCodegenSchemaUsage(schema: OpenAPIX.SchemaObject | OpenAPIX.ReferenceObject, state: InternalCodegenState, options: SchemaUsageOptions): CodegenSchemaUsage {
	const $ref = isOpenAPIReferenceObject(schema) ? schema.$ref : undefined
	const originalSchema = isOpenAPIReferenceObject(schema) ? schema : undefined
	schema = resolveReference(schema, state)
	fixSchema(schema, state)

	const schemaObject = toCodegenSchema(schema, $ref, options.suggestedName, options.purpose, options.scope, state)
	const result: CodegenSchemaUsage = {
		...extractCodegenSchemaInfo(schemaObject),
		required: options.required,
		schema: schemaObject,
		examples: null,
		defaultValue: null,
	}

	if (originalSchema) {
		/* We allow some properties to be overriden on a $ref */
		const originalSchemaAsSchema: OpenAPIX.SchemaObject = originalSchema
		if (originalSchemaAsSchema.nullable) {
			result.nullable = true
		}
		if (originalSchemaAsSchema.readOnly) {
			result.readOnly = true
		}
		if (originalSchemaAsSchema.writeOnly) {
			result.writeOnly = true
		}
		if (originalSchemaAsSchema.deprecated) {
			result.deprecated = true
		}
	}

	/* Apply the schema usage to the native type */
	const usageTransformer = state.generator.nativeTypeUsageTransformer(result)
	result.nativeType = typeof usageTransformer === 'object'
		? new CodegenFullTransformingNativeTypeImpl(result.nativeType, usageTransformer)
		: new CodegenTransformingNativeTypeImpl(result.nativeType, usageTransformer)

	result.examples = schema.example ? toCodegenExamples(schema.example, undefined, undefined, result, state) : null
	result.defaultValue = schema.default !== undefined ? {
		value: schema.default,
		literalValue: state.generator.toLiteral(schema.default, {
			...result,
		}),
	} : null

	return result
}

function toCodegenSchema(schema: OpenAPIX.SchemaObject, $ref: string | undefined, suggestedName: string, purpose: CodegenSchemaPurpose, suggestedScope: CodegenScope | null, state: InternalCodegenState): CodegenSchema {
	/* Check if we've already generated this schema, and return it */
	const existing = state.knownSchemas.get(schema)
	if (existing) {
		return existing
	}

	const schemaType = toCodegenSchemaTypeFromSchema(schema)

	/* Use purpose to refine the suggested name */
	suggestedName = state.generator.toSuggestedSchemaName(suggestedName, {
		purpose,
		schemaType,
	})

	const naming = supportedNamedSchema(schemaType, !!$ref, purpose, state) ? toUniqueScopedName($ref, suggestedName, suggestedScope, schema, schemaType, state) : null
	if (naming) {
		usedSchemaName(naming.scopedName, state)
	}

	/* Due to the recursive nature of nameFromRef, we might have actually generated a schema for us now! */
	const existingNow = state.knownSchemas.get(schema)
	if (existingNow) {
		return existingNow
	}
	
	let result: CodegenSchema
	switch (schemaType) {
		case CodegenSchemaType.MAP:
			result = toCodegenMapSchema(schema, naming, naming ? 'value' : suggestedName, naming ? naming.scope : suggestedScope, state)
			break
		case CodegenSchemaType.OBJECT:
			if (!naming) {
				// naming = toUniqueScopedName($ref, suggestedName, suggestedScope, schema, state)
				throw new Error(`no name for ${JSON.stringify(schema)}`)
			}
			result = toCodegenObjectSchema(schema, naming, $ref, state)
			break
		case CodegenSchemaType.INTERFACE:
			throw new Error(`Cannot create an interface directly from an OpenAPI schema: ${JSON.stringify(schema)}`)
		case CodegenSchemaType.WRAPPER:
			throw new Error(`Cannot create a wrapper directly from an OpenAPI schema: ${JSON.stringify(schema)}`)
		case CodegenSchemaType.ALLOF:
			if (!naming) {
				throw new Error(`no name for ${JSON.stringify(schema)}`)
			}
			result = toCodegenAllOfSchema(schema, naming, $ref, state)
			break
		case CodegenSchemaType.ANYOF:
			if (!naming) {
				throw new Error(`no name for ${JSON.stringify(schema)}`)
			}
			result = toCodegenAnyOfSchema(schema, naming, $ref, state)
			break
		case CodegenSchemaType.ONEOF:
			if (!naming) {
				throw new Error(`no name for ${JSON.stringify(schema)}`)
			}
			result = toCodegenOneOfSchema(schema, naming, $ref, state)
			break
		case CodegenSchemaType.ARRAY:
			result = toCodegenArraySchema(schema, naming, naming ? 'item' : suggestedName, naming ? naming.scope : suggestedScope, state)
			break
		case CodegenSchemaType.ENUM:
			result = toCodegenEnumSchema(schema, naming, state)
			break
		case CodegenSchemaType.NUMBER:
		case CodegenSchemaType.INTEGER:
			result = toCodegenNumericSchema(schema, naming, state)
			break
		case CodegenSchemaType.STRING:
			result = toCodegenStringSchema(schema, naming, state)
			break
		case CodegenSchemaType.BOOLEAN:
			result = toCodegenBooleanSchema(schema, naming, state)
			break
		case CodegenSchemaType.DATE:
		case CodegenSchemaType.DATETIME:
		case CodegenSchemaType.TIME:
		case CodegenSchemaType.FILE: {
			if (typeof schema.type !== 'string') {
				throw new Error(`Unsupported schema type "${schema.type}" for property in ${JSON.stringify(schema)}`)
			}

			/* Generic unsupported schema support */
			const type = schema.type
			const format: string | undefined = schema.format
			const vendorExtensions = toCodegenVendorExtensions(schema)

			const nativeType = state.generator.toNativeType({
				type,
				format,
				schemaType: CodegenSchemaType.FILE,
				vendorExtensions,
			})

			result = {
				...extractNaming(naming),
				type,
				format: format || null,
				schemaType: toCodegenSchemaType(type, format),
				nativeType,
				component: null,

				vendorExtensions,

				...extractCodegenSchemaCommon(schema, state),
			}
			break
		}
	}

	result = addToKnownSchemas(schema, result, state)

	if (naming) {
		addToScope(result, naming.scope, state)
	}
	return result
}

// TODO this will be customised by the generator
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
 * @param schema 
 */
function fixSchema(schema: OpenAPIX.SchemaObject, state: InternalCodegenState): void {
	if (schema.type === undefined) {
		if (schema.required || schema.properties || schema.additionalProperties) {
			schema.type = 'object'
		} else if (schema.enum) {
			schema.type = 'string'
		}
	}

	/* Some specs have the enum declared at the array level, rather than the items. The Vimeo API schema is an example.
	   https://raw.githubusercontent.com/vimeo/openapi/master/api.yaml
	*/
	if (schema.type === 'array' && schema.enum) {
		if (schema.items) {
			const items = resolveReference(schema.items, state)
			if (!items.enum) {
				items.enum = schema.enum
				schema.enum = undefined
			}
		}
	}
}
