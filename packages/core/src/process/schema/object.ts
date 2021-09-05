import { CodegenObjectSchema, CodegenSchemaType, CodegenSchemaUsage, CodegenScope } from '@openapi-generator-plus/types'
import { isOpenAPIv3SchemaObject } from '../../openapi-type-guards'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { extractCodegenSchemaInfo } from '../utils'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { extractNaming, ScopedModelInfo, toUniqueScopedName, usedSchemaName } from './naming'
import { addToKnownSchemas, addToScope, extractCodegenSchemaCommon } from './utils'
import { toCodegenExamples } from '../examples'
import { toCodegenMapSchema } from './map'
import { toCodegenSchemaDiscriminator } from './discriminator'
import { toCodegenProperties } from './property'

export function toCodegenObjectSchema(schema: OpenAPIX.SchemaObject, naming: ScopedModelInfo, $ref: string | undefined, state: InternalCodegenState): CodegenObjectSchema {
	const { scopedName } = naming
	
	const vendorExtensions = toCodegenVendorExtensions(schema)

	const nativeType = state.generator.toNativeObjectType({
		type: schema.type as string,
		format: schema.format,
		scopedName,
		vendorExtensions,
	})

	let model: CodegenObjectSchema = {
		...extractNaming(naming),

		...extractCodegenSchemaCommon(schema, state),

		properties: null,
		additionalProperties: null,
		examples: null,
		discriminator: null,
		discriminatorValues: null,
		children: null,
		vendorExtensions,
		nativeType,
		type: 'object',
		format: schema.format || null,
		schemaType: CodegenSchemaType.OBJECT,
		interface: null,
		implements: null,
		parents: null,
		schemas: null,
		component: null,
		deprecated: false,
	}

	model.examples = toCodegenExamples(schema.example, undefined, undefined, model, state)

	if (isOpenAPIv3SchemaObject(schema, state.specVersion)) {
		model.deprecated = schema.deprecated || false
	}

	/* Must add model to knownSchemas here before we try to load other models to avoid infinite loop
	   when a model references other models that in turn reference this model.
	 */
	model = addToKnownSchemas(schema, model, state)

	model.properties = toCodegenProperties(schema, model, state) || null

	if (schema.additionalProperties) {
		/* This schema also has additional properties */
		const mapSchema = toCodegenMapSchema(schema, naming, 'value', model, state)
		model.additionalProperties = mapSchema
	}
		
	model.discriminator = toCodegenSchemaDiscriminator(schema, model, state)

	return model
}

/**
 * Create a new schema usage of an object type with the given name, in the given scope, and add it to that scope.
 * @param suggestedName the suggested name to use, but a unique name will be chosen in that scope
 * @param scope the scope in which to create the object, or `null` to create in the global scope 
 * @param state 
 * @returns 
 */
export function createObjectSchemaUsage(suggestedName: string, scope: CodegenScope | null, state: InternalCodegenState): CodegenSchemaUsage<CodegenObjectSchema> {
	const naming = toUniqueScopedName(undefined, suggestedName, scope, undefined, CodegenSchemaType.OBJECT, state)

	const nativeType = state.generator.toNativeObjectType({
		type: 'object',
		scopedName: naming.scopedName,
		vendorExtensions: null,
	})

	const schema: CodegenObjectSchema = {
		...extractNaming(naming),
		type: 'object',
		format: null,
		schemaType: CodegenSchemaType.OBJECT,
		properties: null,
		additionalProperties: null,
		examples: null,
		discriminator: null,
		discriminatorValues: null,
		children: null,
		interface: null,
		implements: null,
		parents: null,
		description: null,
		title: null,
		vendorExtensions: null,
		nullable: false,
		readOnly: false,
		writeOnly: false,
		deprecated: false,
		nativeType,
		component: null,
		schemas: null,
	}

	addToScope(schema, scope, state)
	usedSchemaName(naming.scopedName, state)

	return {
		...extractCodegenSchemaInfo(schema),
		required: false,
		schema,
		examples: null,
		defaultValue: null,
	}
}
