import { CodegenArrayTypePurpose, CodegenMapTypePurpose, CodegenSchema, CodegenSchemaPurpose, CodegenSchemaType, CodegenSchemaUsage, CodegenScope } from '@openapi-generator-plus/types'
import { OpenAPIV2, OpenAPIV3 } from 'openapi-types'
import { isOpenAPIReferenceObject, isOpenAPIV2Document } from '../../openapi-type-guards'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { toCodegenExamples } from '../examples'
import { extractCodegenSchemaInfo, resolveReference } from '../utils'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { toCodegenArraySchema } from './array'
import { toCodegenBooleanSchema } from './boolean'
import { toCodegenEnumSchema } from './enum'
import { toCodegenMapSchema } from './map'
import { fullyQualifiedName } from './naming'
import { toCodegenNumericSchema } from './numeric'
import { toCodegenObjectSchema } from './object'
import { toCodegenSchemaType, toCodegenSchemaTypeFromSchema } from './schema-type'
import { toCodegenStringSchema } from './string'
import { extractCodegenSchemaCommon } from './utils'

export function discoverCodegenSchemas(specSchemas: OpenAPIV2.DefinitionsObject | Record<string, OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject>, state: InternalCodegenState): void {
	/* Collect defined schema names first, so no inline or external schemas can use those names */
	for (const schemaName in specSchemas) {
		const fqn = fullyQualifiedName([schemaName])
		state.usedModelFullyQualifiedNames[fqn] = true
		state.reservedNames[refForSchemaName(schemaName, state)] = fqn
	}

	for (const schemaName in specSchemas) {
		/* We load the model using a reference as we use references to distinguish between explicit and inline models */
		const reference: OpenAPIX.ReferenceObject = {
			$ref: refForSchemaName(schemaName, state),
		}

		toCodegenSchemaUsage(reference, true, schemaName, CodegenSchemaPurpose.MODEL, null, state)
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

export function toCodegenSchemaUsage(schema: OpenAPIX.SchemaObject | OpenAPIX.ReferenceObject, required: boolean, suggestedName: string, purpose: CodegenSchemaPurpose, scope: CodegenScope | null, state: InternalCodegenState): CodegenSchemaUsage {
	const $ref = isOpenAPIReferenceObject(schema) ? schema.$ref : undefined
	schema = resolveReference(schema, state)
	fixSchema(schema, state)

	/* Use purpose to refine the suggested name */
	suggestedName = state.generator.toSuggestedSchemaName(suggestedName, {
		purpose,
		schemaType: toCodegenSchemaTypeFromSchema(schema),
	})

	const schemaObject = toCodegenSchema(schema, $ref, suggestedName, purpose, scope, state)
	const result: CodegenSchemaUsage = {
		...extractCodegenSchemaInfo(schemaObject),
		required,
		schema: schemaObject,
		examples: null,
		defaultValue: null,
	}
	if (result.schemaType !== CodegenSchemaType.OBJECT && result.schemaType !== CodegenSchemaType.ENUM && result.schemaType !== CodegenSchemaType.ARRAY && result.schemaType !== CodegenSchemaType.MAP) {
		result.nativeType = state.generator.toNativeType({
			type: result.type,
			format: result.format,
			vendorExtensions: schemaObject.vendorExtensions,
			required,
		})
	}

	result.examples = schema.example ? toCodegenExamples(schema.example, undefined, undefined, result, state) : null
	result.defaultValue = schema.default ? state.generator.toDefaultValue(schema.default, {
		...result,
		required,
	}) : null

	return result
}

function toCodegenSchema(schema: OpenAPIX.SchemaObject, $ref: string | undefined, suggestedName: string, purpose: CodegenSchemaPurpose, scope: CodegenScope | null, state: InternalCodegenState): CodegenSchema {
	if (isObjectSchema(schema, state)) {
		return toCodegenObjectSchema(schema, $ref, suggestedName, purpose === CodegenSchemaPurpose.PARTIAL_MODEL, scope, state)
	} else if (schema.type === 'array') {
		return toCodegenArraySchema(schema, $ref, suggestedName, scope, CodegenArrayTypePurpose.PROPERTY, state)
	} else if (schema.type === 'object' && schema.additionalProperties) {
		return toCodegenMapSchema(schema, $ref, suggestedName, scope, CodegenMapTypePurpose.PROPERTY, state)
	} else if (schema.enum) {
		return toCodegenEnumSchema(schema, $ref, suggestedName, scope, state)
	} else if (schema.type === 'number' || schema.type === 'integer') {
		return toCodegenNumericSchema(schema, state)
	} else if (schema.type === 'string') {
		return toCodegenStringSchema(schema, state)
	} else if (schema.type === 'boolean') {
		return toCodegenBooleanSchema(schema, state)
	} else if (typeof schema.type === 'string') {
		/* Generic unsupported schema support */
		const type = schema.type
		const format: string | undefined = schema.format
		const vendorExtensions = toCodegenVendorExtensions(schema)

		const nativeType = state.generator.toNativeType({
			type,
			format,
			required: true,
			vendorExtensions,
		})

		const result: CodegenSchema = {
			type,
			format: format || null,
			schemaType: toCodegenSchemaType(type, format),
			nativeType,
			componentSchema: null,

			vendorExtensions,

			...extractCodegenSchemaCommon(schema, state),
		}
		return result
	} else {
		throw new Error(`Unsupported schema type "${schema.type}" for property in ${JSON.stringify(schema)}`)
	}
}

function isObjectSchema(schema: OpenAPIX.SchemaObject, state: InternalCodegenState): boolean {
	if ((schema.type === 'object' && !schema.additionalProperties) || schema.allOf || schema.anyOf || schema.oneOf) {
		return true
	}

	if (schema.type === 'array' && state.generator.generateCollectionModels && state.generator.generateCollectionModels()) {
		return true
	}

	if (schema.type === 'object' && schema.additionalProperties && state.generator.generateCollectionModels && state.generator.generateCollectionModels()) {
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
	if (schema.type === undefined && (schema.required || schema.properties || schema.additionalProperties)) {
		schema.type = 'object'
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
