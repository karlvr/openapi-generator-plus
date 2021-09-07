import { CodegenInterfaceSchema, CodegenOneOfSchema, CodegenOneOfStrategy, CodegenSchema, CodegenSchemaPurpose, CodegenSchemaType, isCodegenCompositionSchema, isCodegenObjectSchema, isCodegenWrapperSchema } from '@openapi-generator-plus/types'
import { toCodegenSchemaUsage } from '.'
import { isOpenAPIv3SchemaObject } from '../../openapi-type-guards'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { toCodegenExamples } from '../examples'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { addToDiscriminator, loadDiscriminatorMappings, toCodegenSchemaDiscriminator } from './discriminator'
import { extractNaming, ScopedModelInfo } from './naming'
import { createCodegenProperty } from './property'
import { addToKnownSchemas, extractCodegenSchemaCommon } from './utils'
import { createWrapperSchemaUsage } from './wrapper'

export function toCodegenOneOfSchema(schema: OpenAPIX.SchemaObject, naming: ScopedModelInfo, $ref: string | undefined, state: InternalCodegenState): CodegenOneOfSchema | CodegenInterfaceSchema {
	const strategy = state.generator.oneOfStrategy()
	switch (strategy) {
		case CodegenOneOfStrategy.NATIVE:
			return toCodegenOneOfSchemaNative(schema, naming, $ref, state)
		case CodegenOneOfStrategy.INTERFACE:
			return toCodegenOneOfSchemaInterface(schema, naming, $ref, state)
	}
	throw new Error(`Unsupported oneOf strategy: ${strategy}`)
}

function toCodegenOneOfSchemaNative(schema: OpenAPIX.SchemaObject, naming: ScopedModelInfo, $ref: string | undefined, state: InternalCodegenState): CodegenOneOfSchema {
	const { scopedName, scope } = naming

	const vendorExtensions = toCodegenVendorExtensions(schema)

	const nativeType = state.generator.toNativeObjectType({
		type: 'object',
		schemaType: CodegenSchemaType.ONEOF,
		scopedName,
		vendorExtensions,
	})

	let model: CodegenOneOfSchema = {
		...extractNaming(naming),
		...extractCodegenSchemaCommon(schema, state),

		discriminator: null,
		discriminatorValues: null,
		vendorExtensions,
		nativeType,
		type: 'oneOf',
		format: null,
		schemaType: CodegenSchemaType.ONEOF,
		component: null,
		deprecated: false,
		examples: null,
		schemas: null,

		composes: [],
		implements: null,
	}

	model.examples = toCodegenExamples(schema.example, undefined, undefined, model, state)

	if (isOpenAPIv3SchemaObject(schema, state.specVersion)) {
		model.deprecated = schema.deprecated || false
	}

	/* Must add model to knownSchemas here before we try to load other models to avoid infinite loop
	   when a model references other models that in turn reference this model.
	 */
	model = addToKnownSchemas(schema, model, state)

	const oneOf = schema.oneOf as Array<OpenAPIX.SchemaObject>
	const added: [OpenAPIX.SchemaObject, CodegenSchema][] = []
	for (const otherSchema of oneOf) {
		const otherModel = toCodegenSchemaUsage(otherSchema, state, {
			purpose: CodegenSchemaPurpose.MODEL,
			required: false,
			scope: state.generator.nativeOneOfCanBeScope() ? model : scope,
			suggestedName: `${model.name}_option`,
		}).schema

		model.composes.push(otherModel)
		added.push([otherSchema, otherModel])
	}

	/* Process discriminator after adding composes so they can be used */
	model.discriminator = toCodegenSchemaDiscriminator(schema, model)
	if (model.discriminator) {
		for (const [otherSchema, otherModel] of added) {
			if (!isCodegenObjectSchema(otherModel)) {
				throw new Error(`oneOf "${model.name}" with discriminator references a non-object schema: ${JSON.stringify(otherSchema)}`)
			}
			addToDiscriminator(model, otherModel, state)
		}
	}
	loadDiscriminatorMappings(model, state)
		
	return model
}

function toCodegenOneOfSchemaInterface(schema: OpenAPIX.SchemaObject, naming: ScopedModelInfo, $ref: string | undefined, state: InternalCodegenState): CodegenInterfaceSchema {
	const { scopedName } = naming

	const vendorExtensions = toCodegenVendorExtensions(schema)

	const nativeType = state.generator.toNativeObjectType({
		type: 'object',
		schemaType: CodegenSchemaType.INTERFACE,
		scopedName,
		vendorExtensions,
	})

	let model: CodegenInterfaceSchema = {
		...extractNaming(naming),
		...extractCodegenSchemaCommon(schema, state),

		discriminator: null,
		discriminatorValues: null,
		vendorExtensions,
		nativeType,
		type: 'object',
		format: null,
		schemaType: CodegenSchemaType.INTERFACE,
		component: null,
		deprecated: false,

		parents: null,
		children: null,
		implementation: null,
		implementors: null,

		properties: null,
		additionalProperties: null,
		examples: null,
		schemas: null,
	}

	model.examples = toCodegenExamples(schema.example, undefined, undefined, model, state)

	if (isOpenAPIv3SchemaObject(schema, state.specVersion)) {
		model.deprecated = schema.deprecated || false
	}

	/* Must add model to knownSchemas here before we try to load other models to avoid infinite loop
	   when a model references other models that in turn reference this model.
	 */
	model = addToKnownSchemas(schema, model, state)

	const oneOf = schema.oneOf as Array<OpenAPIX.SchemaObject>
	const added: [OpenAPIX.SchemaObject, CodegenSchema][] = []
	for (const otherSchema of oneOf) {
		const otherModelUsage = toCodegenSchemaUsage(otherSchema, state, {
			purpose: CodegenSchemaPurpose.MODEL,
			required: false,
			scope: model,
			suggestedName: `${model.name}_option`,
		})
		let otherModel = otherModelUsage.schema

		if (!isCodegenObjectSchema(otherModel) && !isCodegenCompositionSchema(otherModel)) {
			/* Create a wrapper around this primitive type */
			const wrapperProperty = createCodegenProperty('value', otherModelUsage, state)
			const wrapper = createWrapperSchemaUsage(`${otherModel.type}_value`, model, wrapperProperty, state).schema
			otherModel = wrapper
		}

		if (!isCodegenObjectSchema(otherModel) && !isCodegenCompositionSchema(otherModel) && !isCodegenWrapperSchema(otherModel)) {
			throw new Error(`Failed to convert oneOf part to object model: ${JSON.stringify(otherSchema)}`)
		}

		if (!model.implementors) {
			model.implementors = []
		}
		model.implementors.push(otherModel)

		if (!otherModel.implements) {
			otherModel.implements = []
		}
		otherModel.implements.push(model)

		added.push([otherSchema, otherModel])
	}

	/* Discriminator - must come after the oneOf relationships are established */
	model.discriminator = toCodegenSchemaDiscriminator(schema, model)
	if (model.discriminator) {
		for (const [otherSchema, otherModel] of added) {
			if (!isCodegenObjectSchema(otherModel)) {
				throw new Error(`oneOf "${model.name}" with discriminator references a non-object schema: ${JSON.stringify(otherSchema)}`)
			}
			addToDiscriminator(model, otherModel, state)
		}
	}
	loadDiscriminatorMappings(model, state)
		
	return model
}
