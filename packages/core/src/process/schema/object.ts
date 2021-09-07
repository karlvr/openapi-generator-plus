import { CodegenAllOfStrategy, CodegenInterfaceSchema, CodegenObjectSchema, CodegenSchemaPurpose, CodegenSchemaType, CodegenSchemaUsage, CodegenScope } from '@openapi-generator-plus/types'
import { isOpenAPIv3SchemaObject } from '../../openapi-type-guards'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { extractCodegenSchemaInfo } from '../utils'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { extractNaming, ScopedModelInfo, toUniqueScopedName, usedSchemaName } from './naming'
import { addToKnownSchemas, addToScope, extractCodegenSchemaCommon } from './utils'
import { toCodegenExamples } from '../examples'
import { toCodegenMapSchema } from './map'
import { loadDiscriminatorMappings, toCodegenSchemaDiscriminator } from './discriminator'
import { toCodegenProperties } from './property'
import { toCodegenExternalDocs } from '../external-docs'

export function toCodegenObjectSchema(schema: OpenAPIX.SchemaObject, naming: ScopedModelInfo, $ref: string | undefined, state: InternalCodegenState): CodegenObjectSchema | CodegenInterfaceSchema {
	if (!schema.discriminator || !interfaceRequiredForDiscriminator(state)) {
		return toCodegenObjectSchemaObject(schema, naming, $ref, state)
	} else {
		return toCodegenObjectSchemaInterface(schema, naming, $ref, state)
	}
}

/**
 * Determine whether we need to turn an object schema into an interface if it contains a discriminator.
 * @param state 
 * @returns 
 */
function interfaceRequiredForDiscriminator(state: InternalCodegenState) {
	/* 
	   If we use the OBJECT allOf strategy, then we need to consider whether we need to turn objects into interfaces if
	   they contain a discriminator.

	   If we support multiple inheritance, then we don't need an interface as we can have the object containing the discriminator
	   as a parent of any members, thus establishing compatibility.

	   If we don't support multiple inheritance (or any form of inheritance) then the schema containing the discriminator needs to
	   be an interface so any members can be compatible with it.
	 */
	return state.generator.allOfStrategy() === CodegenAllOfStrategy.OBJECT && !(state.generator.supportsInheritance() && state.generator.supportsMultipleInheritance())
}

function toCodegenObjectSchemaObject(schema: OpenAPIX.SchemaObject, naming: ScopedModelInfo, $ref: string | undefined, state: InternalCodegenState): CodegenObjectSchema {
	const { scopedName } = naming
	
	const vendorExtensions = toCodegenVendorExtensions(schema)

	const nativeType = state.generator.toNativeObjectType({
		type: schema.type as string,
		format: schema.format,
		schemaType: CodegenSchemaType.OBJECT,
		scopedName,
		vendorExtensions,
	})

	let model: CodegenObjectSchema = {
		...extractNaming(naming),

		...extractCodegenSchemaCommon(schema, state),

		abstract: false,
		properties: null,
		additionalProperties: null,
		examples: null,
		discriminator: null,
		discriminatorValues: null,
		children: null,
		vendorExtensions,
		externalDocs: toCodegenExternalDocs(schema),
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

	model = handleObjectCommon(schema, naming, model, state)
	// TODO we previous had an issue where a member of a discriminator didn't discover the discriminator
	// because of order-of-operations between populating model.discriminator and the member being created
	// and looking for it. If that happens again, this is one approach to work around it.
	// if (model.discriminator && model.children) {
	// 	for (const aSchema of model.children) {
	// 		if (isCodegenDiscriminatableSchema(aSchema)) {
	// 			addToDiscriminator(model, aSchema, state)
	// 		}
	// 	}
	// }
	return model
}

function toCodegenObjectSchemaInterface(schema: OpenAPIX.SchemaObject, naming: ScopedModelInfo, $ref: string | undefined, state: InternalCodegenState): CodegenInterfaceSchema {
	const { scopedName } = naming
	
	const vendorExtensions = toCodegenVendorExtensions(schema)

	const nativeType = state.generator.toNativeObjectType({
		type: schema.type as string,
		format: schema.format,
		schemaType: CodegenSchemaType.INTERFACE,
		scopedName,
		vendorExtensions,
	})

	let model: CodegenInterfaceSchema = {
		...extractNaming(naming),

		...extractCodegenSchemaCommon(schema, state),

		properties: null,
		additionalProperties: null,
		examples: null,
		discriminator: null,
		discriminatorValues: null,
		children: null,
		vendorExtensions,
		externalDocs: toCodegenExternalDocs(schema),
		nativeType,
		type: 'object',
		format: schema.format || null,
		schemaType: CodegenSchemaType.INTERFACE,
		implementation: null,
		implementors: null,
		parents: null,
		schemas: null,
		component: null,
		deprecated: false,
	}

	model = handleObjectCommon(schema, naming, model, state)
	// TODO we previous had an issue where a member of a discriminator didn't discover the discriminator
	// because of order-of-operations between populating model.discriminator and the member being created
	// and looking for it. If that happens again, this is one approach to work around it.
	// if (model.discriminator && model.implementors) {
	// 	for (const aSchema of model.implementors) {
	// 		if (isCodegenDiscriminatableSchema(aSchema)) {
	// 			addToDiscriminator(model, aSchema, state)
	// 		}
	// 	}
	// }

	return model
}

function handleObjectCommon<T extends CodegenObjectSchema | CodegenInterfaceSchema>(schema: OpenAPIX.SchemaObject, naming: ScopedModelInfo, model: T, state: InternalCodegenState) {
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
		
	model.discriminator = toCodegenSchemaDiscriminator(schema, model)
	loadDiscriminatorMappings(model, state)
	return model
}

/**
 * Create a new schema usage of an object type with the given name, in the given scope, and add it to that scope.
 * @param suggestedName the suggested name to use, but a unique name will be chosen in that scope
 * @param scope the scope in which to create the object, or `null` to create in the global scope 
 * @param state 
 * @returns 
 */
export function createObjectSchemaUsage(suggestedName: string, scope: CodegenScope | null, purpose: CodegenSchemaPurpose, state: InternalCodegenState): CodegenSchemaUsage<CodegenObjectSchema> {
	suggestedName = state.generator.toSuggestedSchemaName(suggestedName, {
		purpose,
		schemaType: CodegenSchemaType.OBJECT,
	})
	
	const naming = toUniqueScopedName(undefined, suggestedName, scope, undefined, CodegenSchemaType.OBJECT, state)

	const nativeType = state.generator.toNativeObjectType({
		type: 'object',
		schemaType: CodegenSchemaType.OBJECT,
		scopedName: naming.scopedName,
		vendorExtensions: null,
	})

	const schema: CodegenObjectSchema = {
		...extractNaming(naming),
		type: 'object',
		format: null,
		schemaType: CodegenSchemaType.OBJECT,
		abstract: false,
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
		externalDocs: null,
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
