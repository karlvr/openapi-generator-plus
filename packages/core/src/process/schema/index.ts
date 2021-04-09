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
import { fullyQualifiedName, toUniqueScopedName, extractNaming } from './naming'
import { toCodegenNumericSchema } from './numeric'
import { toCodegenObjectSchema } from './object'
import { toCodegenSchemaType, toCodegenSchemaTypeFromSchema } from './schema-type'
import { toCodegenStringSchema } from './string'
import { addToKnownSchemas, addToScope, extractCodegenSchemaCommon } from './utils'

export function discoverCodegenSchemas(specSchemas: OpenAPIV2.DefinitionsObject | Record<string, OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject>, state: InternalCodegenState): void {
	/* Collect defined schema names first, so no inline or external schemas can use those names */
	for (const schemaName in specSchemas) {
		const fqn = fullyQualifiedName([schemaName])
		state.usedFullyQualifiedSchemaNames[fqn] = true
		state.reservedSchemaNames[refForSchemaName(schemaName, state)] = fqn
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
	result.defaultValue = schema.default !== undefined ? {
		value: schema.default,
		literalValue: state.generator.toLiteral(schema.default, {
			...result,
			required,
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

	const naming = supportedNamedSchema(schemaType, !!$ref, purpose, state) ? toUniqueScopedName($ref, suggestedName, suggestedScope, schema, state) : null
	if (naming) {
		state.usedFullyQualifiedSchemaNames[fullyQualifiedName(naming.scopedName)] = true
	}

	/* Due to the recursive nature of nameFromRef, we might have actually generated a schema for us now! */
	const existingNow = state.knownSchemas.get(schema)
	if (existingNow) {
		return existingNow
	}
	
	let result: CodegenSchema
	if (isObjectSchema(schema, state)) {
		if (!naming) {
			// naming = toUniqueScopedName($ref, suggestedName, suggestedScope, schema, state)
			throw new Error(`no name for ${JSON.stringify(schema)}`)
		}
		result = toCodegenObjectSchema(schema, naming, $ref, state)
	} else if (schema.type === 'array') {
		result = toCodegenArraySchema(schema, naming, naming ? 'item' : suggestedName, naming ? naming.scope : suggestedScope, CodegenArrayTypePurpose.PROPERTY, state)
	} else if (schema.type === 'object' && schema.additionalProperties) {
		result = toCodegenMapSchema(schema, naming, naming ? 'value' : suggestedName, naming ? naming.scope : suggestedScope, CodegenMapTypePurpose.PROPERTY, state)
	} else if (schema.enum) {
		result = toCodegenEnumSchema(schema, naming, state)
	} else if (schema.type === 'number' || schema.type === 'integer') {
		result = toCodegenNumericSchema(schema, naming, state)
	} else if (schema.type === 'string') {
		result = toCodegenStringSchema(schema, naming, state)
	} else if (schema.type === 'boolean') {
		result = toCodegenBooleanSchema(schema, naming, state)
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

		result = {
			...extractNaming(naming),
			type,
			format: format || null,
			schemaType: toCodegenSchemaType(type, format),
			nativeType,
			componentSchema: null,

			vendorExtensions,

			...extractCodegenSchemaCommon(schema, state),
		}
	} else {
		throw new Error(`Unsupported schema type "${schema.type}" for property in ${JSON.stringify(schema)}`)
	}

	result = addToKnownSchemas(schema, result, state)

	if (naming) {
		addToScope(result, naming.scope, state)
	}
	return result
}

// TODO this will be customised by the generator
function supportedNamedSchema(schemaType: CodegenSchemaType, referenced: boolean, purpose: CodegenSchemaPurpose, state: InternalCodegenState): boolean {
	if (schemaType === CodegenSchemaType.OBJECT || schemaType === CodegenSchemaType.ENUM) {
		return true
	}
	
	if (schemaType === CodegenSchemaType.ARRAY && state.generator.generateCollectionModels && state.generator.generateCollectionModels()) {
		return true
	}

	if (schemaType === CodegenSchemaType.MAP && state.generator.generateCollectionModels && state.generator.generateCollectionModels()) {
		return true
	}

	return false
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
