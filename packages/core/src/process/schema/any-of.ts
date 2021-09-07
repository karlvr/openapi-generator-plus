import { CodegenAnyOfSchema, CodegenAnyOfStrategy, CodegenObjectSchema, CodegenSchema, CodegenSchemaPurpose, CodegenSchemaType, isCodegenObjectSchema } from '@openapi-generator-plus/types'
import { toCodegenSchemaUsage } from '.'
import { isOpenAPIv3SchemaObject } from '../../openapi-type-guards'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { toCodegenExamples } from '../examples'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { addToDiscriminator, loadDiscriminatorMappings, toCodegenSchemaDiscriminator } from './discriminator'
import { toCodegenInterfaceSchema } from './interface'
import { extractNaming, ScopedModelInfo } from './naming'
import { absorbModel } from './object-absorb'
import { addToKnownSchemas, extractCodegenSchemaCommon } from './utils'

export function toCodegenAnyOfSchema(schema: OpenAPIX.SchemaObject, naming: ScopedModelInfo, $ref: string | undefined, state: InternalCodegenState): CodegenAnyOfSchema | CodegenObjectSchema {
	const strategy = state.generator.anyOfStrategy()
	switch (strategy) {
		case CodegenAnyOfStrategy.NATIVE:
			return toCodegenAnyOfSchemaNative(schema, naming, $ref, state)
		case CodegenAnyOfStrategy.OBJECT:
			return toCodegenAnyOfSchemaObject(schema, naming, $ref, state)
	}
	throw new Error(`Unsupported anyOf strategy: ${strategy}`)
}

function toCodegenAnyOfSchemaNative(schema: OpenAPIX.SchemaObject, naming: ScopedModelInfo, $ref: string | undefined, state: InternalCodegenState): CodegenAnyOfSchema {
	const { scopedName, scope } = naming

	const vendorExtensions = toCodegenVendorExtensions(schema)

	const nativeType = state.generator.toNativeObjectType({
		type: schema.type as string,
		schemaType: CodegenSchemaType.ANYOF,
		scopedName,
		vendorExtensions,
	})

	let model: CodegenAnyOfSchema = {
		...extractNaming(naming),

		...extractCodegenSchemaCommon(schema, state),

		discriminator: null,
		discriminatorValues: null,
		vendorExtensions,
		nativeType,
		type: 'anyOf',
		format: null,
		schemaType: CodegenSchemaType.ANYOF,
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

	/* We bundle all of the properties together into this model and turn the subModels into interfaces */
	const anyOf = schema.anyOf as Array<OpenAPIX.SchemaObject>
	const added: [OpenAPIX.SchemaObject, CodegenSchema][] = []
	for (const otherSchema of anyOf) {
		const otherModel = toCodegenSchemaUsage(otherSchema, state, {
			purpose: CodegenSchemaPurpose.MODEL,
			required: false,
			scope,
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
				throw new Error(`anyOf "${model.name}" with discriminator references a non-object schema: ${JSON.stringify(otherSchema)}`)
			}
			addToDiscriminator(model, otherModel, state)
		}
	}

	loadDiscriminatorMappings(model, state)

	// for (const subSchema of anyOf) {
	// 	const subSchemaUsage = toCodegenSchemaUsage(subSchema, state, {
	// 		required: true,
	// 		suggestedName: 'submodel',
	// 		purpose: CodegenSchemaPurpose.MODEL,
	// 		scope: model,
	// 	})
	// 	const subModel = subSchemaUsage.schema
	// 	if (!isCodegenObjectSchema(subModel)) {
	// 		// TODO
	// 		throw new Error(`Non-model schema not yet supported in anyOf: ${subSchema}`)
	// 	}

	// 	absorbModel(subModel, { includeNestedModels: false, makePropertiesOptional: true })
	// 	subModel.isInterface = true // TODO if a submodel is also required to be concrete, perhaps we should create separate interface and concrete implementations of the same model

	// 	if (!model.implements) {
	// 		model.implements = idx.create()
	// 	}
	// 	idx.set(model.implements, subModel.name, subModel)
	// 	if (!subModel.implementors) {
	// 		subModel.implementors = idx.create()
	// 	}
	// 	idx.set(subModel.implementors, model.name, model)
	// }
		
	return model
}

function toCodegenAnyOfSchemaObject(schema: OpenAPIX.SchemaObject, naming: ScopedModelInfo, $ref: string | undefined, state: InternalCodegenState): CodegenObjectSchema {
	const { scopedName, scope } = naming

	const vendorExtensions = toCodegenVendorExtensions(schema)

	const nativeType = state.generator.toNativeObjectType({
		type: schema.type as string,
		schemaType: CodegenSchemaType.OBJECT,
		scopedName,
		vendorExtensions,
	})

	let model: CodegenObjectSchema = {
		...extractNaming(naming),

		...extractCodegenSchemaCommon(schema, state),

		discriminator: null,
		discriminatorValues: null,
		vendorExtensions,
		nativeType,
		type: 'object',
		format: null,
		schemaType: CodegenSchemaType.OBJECT,
		component: null,
		deprecated: false,

		additionalProperties: null,
		properties: null,
		examples: null,
		children: null,
		interface: null,
		implements: null,
		parents: null,
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

	const anyOf = schema.anyOf as Array<OpenAPIX.SchemaObject>
	const added: [OpenAPIX.SchemaObject, CodegenSchema][] = []

	/* Absorb models and use interface conformance */
	for (const otherSchema of anyOf) {
		/* We must absorb the schema from the others, and then indicate that we conform to them */
		const subModel = toCodegenSchemaUsage(otherSchema, state, {
			required: true,
			suggestedName: `${model.name}_submodel`,
			purpose: CodegenSchemaPurpose.MODEL,
			scope: model,
		}).schema
		if (!isCodegenObjectSchema(subModel)) {
			// TODO
			throw new Error(`Non-object schema not yet supported in anyOf: ${JSON.stringify(otherSchema)}`)
		}

		absorbModel(subModel, model, { includeNestedModels: false, makePropertiesOptional: true })

		/* Make sure there's an interface schema to use */
		const interfaceSchema = toCodegenInterfaceSchema(subModel, scope, state)

		if (!model.implements) {
			model.implements = []
		}
		model.implements.push(interfaceSchema)

		if (!interfaceSchema.implementors) {
			interfaceSchema.implementors = []
		}
		interfaceSchema.implementors.push(model)
		added.push([otherSchema, interfaceSchema])

		// addDiscriminatorValues(otherModel, model, state)

		// const otherModel = toCodegenSchemaUsage(otherSchema, state, {
		// 	purpose: CodegenSchemaPurpose.MODEL,
		// 	required: false,
		// 	scope,
		// 	suggestedName: `${model.name}_option`,
		// }).schema

		// if (model.discriminator) {
		// 	if (!isCodegenObjectSchema(subModel)) {
		// 		throw new Error(`anyOf "${model.name}" with discriminator references a non-object schema: ${otherSchema}`)
		// 	}
		// 	handleDiscriminator(model, subModel, state)
		// }
	}

	/* Process discriminator after adding composes so they can be used */
	model.discriminator = toCodegenSchemaDiscriminator(schema, model)
	if (model.discriminator) {
		for (const [otherSchema, otherModel] of added) {
			if (!isCodegenObjectSchema(otherModel)) {
				throw new Error(`anyOf "${model.name}" with discriminator references a non-object schema: ${JSON.stringify(otherSchema)}`)
			}
			addToDiscriminator(model, otherModel, state)
		}
	}
	
	loadDiscriminatorMappings(model, state)

	// for (const subSchema of anyOf) {
	// 	const subSchemaUsage = toCodegenSchemaUsage(subSchema, state, {
	// 		required: true,
	// 		suggestedName: 'submodel',
	// 		purpose: CodegenSchemaPurpose.MODEL,
	// 		scope: model,
	// 	})
	// 	const subModel = subSchemaUsage.schema
	// 	if (!isCodegenObjectSchema(subModel)) {
	// 		// TODO
	// 		throw new Error(`Non-model schema not yet supported in anyOf: ${subSchema}`)
	// 	}

	// 	absorbModel(subModel, { includeNestedModels: false, makePropertiesOptional: true })
	// 	subModel.isInterface = true // TODO if a submodel is also required to be concrete, perhaps we should create separate interface and concrete implementations of the same model

	// 	if (!model.implements) {
	// 		model.implements = idx.create()
	// 	}
	// 	idx.set(model.implements, subModel.name, subModel)
	// 	if (!subModel.implementors) {
	// 		subModel.implementors = idx.create()
	// 	}
	// 	idx.set(subModel.implementors, model.name, model)
	// }
		
	return model
}
