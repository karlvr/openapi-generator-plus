import { CodegenDiscriminatorSchema, CodegenInterfaceSchema, CodegenObjectSchema, CodegenOneOfSchema, CodegenOneOfStrategy, CodegenSchema, CodegenSchemaPurpose, CodegenSchemaType, isCodegenCompositionSchema, isCodegenObjectSchema, isCodegenWrapperSchema } from '@openapi-generator-plus/types'
import { toCodegenSchemaUsage } from '.'
import { idx } from '../..'
import { isOpenAPIv3SchemaObject } from '../../openapi-type-guards'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { toCodegenExamples } from '../examples'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { findDiscriminatorValue, toCodegenSchemaDiscriminator } from './discriminator'
import { extractNaming, ScopedModelInfo } from './naming'
import { createObjectSchemaUsage } from './object'
import { createCodegenProperty } from './property'
import { addToKnownSchemas, extractCodegenSchemaCommon, removeProperty } from './utils'
import { createWrapperSchemaUsage } from './wrapper'

export function toCodegenOneOfSchema(schema: OpenAPIX.SchemaObject, naming: ScopedModelInfo, $ref: string | undefined, state: InternalCodegenState): CodegenOneOfSchema | CodegenInterfaceSchema {
	const strategy = state.generator.oneOfStrategy()
	switch (strategy) {
		case CodegenOneOfStrategy.NATIVE:
			return toCodegenOneOfSchemaNative(schema, naming, $ref, state)
		case CodegenOneOfStrategy.OBJECT:
			return toCodegenOneOfSchemaObject(schema, naming, $ref, state)
	}
	throw new Error(`Unsupported oneOf strategy: ${strategy}`)
}

function toCodegenOneOfSchemaNative(schema: OpenAPIX.SchemaObject, naming: ScopedModelInfo, $ref: string | undefined, state: InternalCodegenState): CodegenOneOfSchema {
	const { scopedName, scope } = naming

	const vendorExtensions = toCodegenVendorExtensions(schema)

	const nativeType = state.generator.toNativeObjectType({
		type: 'object',
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

	model.discriminator = toCodegenSchemaDiscriminator(schema, model, state)

	const oneOf = schema.oneOf as Array<OpenAPIX.SchemaObject>
	for (const otherSchema of oneOf) {
		const otherModel = toCodegenSchemaUsage(otherSchema, state, {
			purpose: CodegenSchemaPurpose.MODEL,
			required: false,
			scope,
			suggestedName: `${model.name}_option`,
		}).schema

		model.composes.push(otherModel)

		if (model.discriminator) {
			if (!isCodegenObjectSchema(otherModel)) {
				throw new Error(`oneOf "${model.name}" with discriminator references a non-object schema: ${JSON.stringify(otherSchema)}`)
			}
			handleDiscriminator(model, otherModel, state)
		}
	}

	// if (schema.discriminator) {
	// 	if (model.properties) {
	// 		throw new Error(`oneOf cannot have properties: ${model.nativeType}`)
	// 	}
	// 	model.isInterface = true

	// 	const schemaDiscriminator = schema.discriminator as OpenAPIV3.DiscriminatorObject
	// 	const mappings = toCodegenDiscriminatorMappings(schemaDiscriminator)
	// 	model.discriminator = {
	// 		name: schemaDiscriminator.propertyName,
	// 		mappings,
	// 		references: [],
	// 		type: 'string',
	// 		format: null,
	// 		component: null,
	// 		schemaType: CodegenSchemaType.STRING,
	// 		nativeType: state.generator.toNativeType({ type: 'string' }),
	// 	}
			
	// 	for (const subSchema of oneOf) {
	// 		const subSchemaUsage = toCodegenSchemaUsage(subSchema, state, {
	// 			required: true, 
	// 			suggestedName: 'submodel',
	// 			purpose: CodegenSchemaPurpose.MODEL,
	// 			scope: model,
	// 		})
	// 		const subModel = subSchemaUsage.schema
	// 		if (!isCodegenObjectSchema(subModel)) {
	// 			throw new Error(`Non-model schema not support in oneOf with discriminator: ${subSchema}`)
	// 		}

	// 		const subModelDiscriminatorProperty = removeModelProperty(subModel.properties || undefined, schemaDiscriminator.propertyName)
	// 		if (!subModelDiscriminatorProperty) {
	// 			throw new Error(`Discriminator property "${schemaDiscriminator.propertyName}" for "${nativeType}" missing from "${subModel.nativeType}"`)
	// 		}

	// 		let discriminatorValue = subModel.name
	// 		if (isOpenAPIReferenceObject(subSchema) && mappings[subSchema.$ref]) {
	// 			discriminatorValue = mappings[subSchema.$ref]
	// 		}

	// 		const discriminatorValueLiteral = state.generator.toLiteral(discriminatorValue, {
	// 			...model.discriminator,
	// 			required: true,
	// 			nullable: false,
	// 			readOnly: false,
	// 			writeOnly: false,
	// 		})
				
	// 		model.discriminator.references.push({
	// 			model: subModel,
	// 			name: discriminatorValue,
	// 			value: discriminatorValueLiteral,
	// 		})

	// 		if (!subModel.discriminatorValues) {
	// 			subModel.discriminatorValues = []
	// 		}
	// 		subModel.discriminatorValues.push({
	// 			model,
	// 			value: discriminatorValueLiteral,
	// 		})

	// 		if (!subModel.implements) {
	// 			subModel.implements = idx.create()
	// 		}
	// 		idx.set(subModel.implements, model.name, model)
	// 		if (!model.implementors) {
	// 			model.implementors = idx.create()
	// 		}
	// 		idx.set(model.implementors, subModel.name, subModel)
	// 	}
	// } else {
	// 	/* Without a discriminator we turn this model into an interface and the submodels implement it */
	// 	model.isInterface = true

	// 	for (const subSchema of oneOf) {
	// 		const subSchemaUsage = toCodegenSchemaUsage(subSchema, state, {
	// 			required: true,
	// 			suggestedName: 'submodel',
	// 			purpose: CodegenSchemaPurpose.MODEL,
	// 			scope: model,
	// 		})
	// 		const subModel = subSchemaUsage.schema
	// 		if (isCodegenObjectSchema(subModel)) {
	// 			if (!subModel.implements) {
	// 				subModel.implements = idx.create()
	// 			}
	// 			idx.set(subModel.implements, model.name, model)
	// 			if (!model.implementors) {
	// 				model.implementors = idx.create()
	// 			}
	// 			idx.set(model.implementors, subModel.name, subModel)
	// 		} else {
	// 			// TODO resolve this hack as we can only have models as implementors, and the TypeScript generator politely handles it
	// 			const fakeName = toUniqueScopedName(undefined, subModel.name || 'fake', model, subSchema, toCodegenSchemaTypeFromSchema(subSchema), state)
	// 			const fakeModel: CodegenObjectSchema = subModel as unknown as CodegenObjectSchema
	// 			if (!fakeModel.implements) {
	// 				fakeModel.implements = idx.create()
	// 			}
	// 			idx.set(fakeModel.implements, model.name, model)
	// 			if (!model.implementors) {
	// 				model.implementors = idx.create()
	// 			}
	// 			idx.set(model.implementors, fakeName.name, subModel)

	// 			usedSchemaName(fakeName.scopedName, state)
	// 		}
	// 	}
	// }
		
	return model
}

function toCodegenOneOfSchemaObject(schema: OpenAPIX.SchemaObject, naming: ScopedModelInfo, $ref: string | undefined, state: InternalCodegenState): CodegenInterfaceSchema {
	const { scopedName, scope } = naming

	const vendorExtensions = toCodegenVendorExtensions(schema)

	const nativeType = state.generator.toNativeObjectType({
		type: 'object',
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

	model.discriminator = toCodegenSchemaDiscriminator(schema, model, state)

	const oneOf = schema.oneOf as Array<OpenAPIX.SchemaObject>
	for (const otherSchema of oneOf) {
		const otherModelUsage = toCodegenSchemaUsage(otherSchema, state, {
			purpose: CodegenSchemaPurpose.MODEL,
			required: false,
			scope,
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

		if (model.discriminator) {
			if (!isCodegenObjectSchema(otherModel)) {
				throw new Error(`oneOf "${model.name}" with discriminator references a non-object schema: ${JSON.stringify(otherSchema)}`)
			}
			handleDiscriminator(model, otherModel, state)
		}
	}

	// if (schema.discriminator) {
	// 	if (model.properties) {
	// 		throw new Error(`oneOf cannot have properties: ${model.nativeType}`)
	// 	}
	// 	model.isInterface = true

	// 	const schemaDiscriminator = schema.discriminator as OpenAPIV3.DiscriminatorObject
	// 	const mappings = toCodegenDiscriminatorMappings(schemaDiscriminator)
	// 	model.discriminator = {
	// 		name: schemaDiscriminator.propertyName,
	// 		mappings,
	// 		references: [],
	// 		type: 'string',
	// 		format: null,
	// 		component: null,
	// 		schemaType: CodegenSchemaType.STRING,
	// 		nativeType: state.generator.toNativeType({ type: 'string' }),
	// 	}
			
	// 	for (const subSchema of oneOf) {
	// 		const subSchemaUsage = toCodegenSchemaUsage(subSchema, state, {
	// 			required: true, 
	// 			suggestedName: 'submodel',
	// 			purpose: CodegenSchemaPurpose.MODEL,
	// 			scope: model,
	// 		})
	// 		const subModel = subSchemaUsage.schema
	// 		if (!isCodegenObjectSchema(subModel)) {
	// 			throw new Error(`Non-model schema not support in oneOf with discriminator: ${subSchema}`)
	// 		}

	// 		const subModelDiscriminatorProperty = removeModelProperty(subModel.properties || undefined, schemaDiscriminator.propertyName)
	// 		if (!subModelDiscriminatorProperty) {
	// 			throw new Error(`Discriminator property "${schemaDiscriminator.propertyName}" for "${nativeType}" missing from "${subModel.nativeType}"`)
	// 		}

	// 		let discriminatorValue = subModel.name
	// 		if (isOpenAPIReferenceObject(subSchema) && mappings[subSchema.$ref]) {
	// 			discriminatorValue = mappings[subSchema.$ref]
	// 		}

	// 		const discriminatorValueLiteral = state.generator.toLiteral(discriminatorValue, {
	// 			...model.discriminator,
	// 			required: true,
	// 			nullable: false,
	// 			readOnly: false,
	// 			writeOnly: false,
	// 		})
				
	// 		model.discriminator.references.push({
	// 			model: subModel,
	// 			name: discriminatorValue,
	// 			value: discriminatorValueLiteral,
	// 		})

	// 		if (!subModel.discriminatorValues) {
	// 			subModel.discriminatorValues = []
	// 		}
	// 		subModel.discriminatorValues.push({
	// 			model,
	// 			value: discriminatorValueLiteral,
	// 		})

	// 		if (!subModel.implements) {
	// 			subModel.implements = idx.create()
	// 		}
	// 		idx.set(subModel.implements, model.name, model)
	// 		if (!model.implementors) {
	// 			model.implementors = idx.create()
	// 		}
	// 		idx.set(model.implementors, subModel.name, subModel)
	// 	}
	// } else {
	// 	/* Without a discriminator we turn this model into an interface and the submodels implement it */
	// 	model.isInterface = true

	// 	for (const subSchema of oneOf) {
	// 		const subSchemaUsage = toCodegenSchemaUsage(subSchema, state, {
	// 			required: true,
	// 			suggestedName: 'submodel',
	// 			purpose: CodegenSchemaPurpose.MODEL,
	// 			scope: model,
	// 		})
	// 		const subModel = subSchemaUsage.schema
	// 		if (isCodegenObjectSchema(subModel)) {
	// 			if (!subModel.implements) {
	// 				subModel.implements = idx.create()
	// 			}
	// 			idx.set(subModel.implements, model.name, model)
	// 			if (!model.implementors) {
	// 				model.implementors = idx.create()
	// 			}
	// 			idx.set(model.implementors, subModel.name, subModel)
	// 		} else {
	// 			// TODO resolve this hack as we can only have models as implementors, and the TypeScript generator politely handles it
	// 			const fakeName = toUniqueScopedName(undefined, subModel.name || 'fake', model, subSchema, toCodegenSchemaTypeFromSchema(subSchema), state)
	// 			const fakeModel: CodegenObjectSchema = subModel as unknown as CodegenObjectSchema
	// 			if (!fakeModel.implements) {
	// 				fakeModel.implements = idx.create()
	// 			}
	// 			idx.set(fakeModel.implements, model.name, model)
	// 			if (!model.implementors) {
	// 				model.implementors = idx.create()
	// 			}
	// 			idx.set(model.implementors, fakeName.name, subModel)

	// 			usedSchemaName(fakeName.scopedName, state)
	// 		}
	// 	}
	// }
		
	return model
}

function handleDiscriminator(model: CodegenDiscriminatorSchema, otherModel: CodegenObjectSchema, state: InternalCodegenState) {
	if (!model.discriminator) {
		return
	}

	const subModelDiscriminatorProperty = removeProperty(otherModel, model.discriminator.name)
	if (!subModelDiscriminatorProperty) {
		throw new Error(`Discriminator property "${model.discriminator.name}" for "${model.name}" missing from "${otherModel.name}"`)
	}
	
	const discriminatorValue = findDiscriminatorValue(model.discriminator, otherModel, state)
	const discriminatorValueLiteral = state.generator.toLiteral(discriminatorValue, {
		...model.discriminator,
		required: true,
		nullable: false,
		readOnly: false,
		writeOnly: false,
	})
	model.discriminator.references.push({
		model: otherModel,
		name: discriminatorValue,
		value: discriminatorValueLiteral,
	})
	if (!otherModel.discriminatorValues) {
		otherModel.discriminatorValues = []
	}
	otherModel.discriminatorValues.push({
		model,
		value: discriminatorValueLiteral,
	})
}
