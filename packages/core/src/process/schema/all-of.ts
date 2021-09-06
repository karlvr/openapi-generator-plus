import { CodegenAllOfSchema, CodegenAllOfStrategy, CodegenDiscriminatorSchema, CodegenObjectSchema, CodegenSchema, CodegenSchemaPurpose, CodegenSchemaType, isCodegenAllOfSchema, isCodegenObjectSchema } from '@openapi-generator-plus/types'
import { toCodegenSchemaUsage } from '.'
import { isOpenAPIReferenceObject, isOpenAPIv3SchemaObject } from '../../openapi-type-guards'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { toCodegenExamples } from '../examples'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { findDiscriminatorValue, toCodegenSchemaDiscriminator } from './discriminator'
import { toCodegenInterfaceSchema } from './interface'
import { extractNaming, ScopedModelInfo } from './naming'
import { absorbSchema } from './object-absorb'
import { addToKnownSchemas, extractCodegenSchemaCommon } from './utils'

export function toCodegenAllOfSchema(schema: OpenAPIX.SchemaObject, naming: ScopedModelInfo, $ref: string | undefined, state: InternalCodegenState): CodegenAllOfSchema | CodegenObjectSchema {
	const strategy = state.generator.allOfStrategy()
	switch (strategy) {
		case CodegenAllOfStrategy.NATIVE:
			return toCodegenAllOfSchemaNative(schema, naming, $ref, state)
		case CodegenAllOfStrategy.OBJECT:
			return toCodegenAllOfSchemaObject(schema, naming, $ref, state)
	}
	throw new Error(`Unsupported allOf strategy: ${strategy}`)
}

function toCodegenAllOfSchemaNative(schema: OpenAPIX.SchemaObject, naming: ScopedModelInfo, $ref: string | undefined, state: InternalCodegenState): CodegenAllOfSchema {
	const { scopedName } = naming

	const vendorExtensions = toCodegenVendorExtensions(schema)

	const nativeType = state.generator.toNativeObjectType({
		type: 'object',
		schemaType: CodegenSchemaType.ALLOF,
		scopedName,
		vendorExtensions,
	})

	let model: CodegenAllOfSchema = {
		...extractNaming(naming),
		...extractCodegenSchemaCommon(schema, state),

		discriminator: null,
		discriminatorValues: null,
		vendorExtensions,
		nativeType,
		type: 'allOf',
		format: null,
		schemaType: CodegenSchemaType.ALLOF,
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

	const allOf = schema.allOf as Array<OpenAPIX.SchemaObject>
	for (const otherSchema of allOf) {
		const otherModel = toCodegenSchemaUsage(otherSchema, state, {
			purpose: CodegenSchemaPurpose.MODEL,
			required: false,
			scope: null,
			suggestedName: `${model.name}_parent`,
		}).schema

		if (!isCodegenObjectSchema(otherModel)) {
			throw new Error(`allOf "${model.name}" references a non-object (${otherModel.schemaType}) schema: ${otherSchema}`)
		}

		model.composes.push(otherModel)
		addDiscriminatorValues(otherModel, model, state)
	}

	model.discriminator = toCodegenSchemaDiscriminator(schema, model, state)

	/* We support single parent inheritance, so check if that's possible.
		   We go for single parent inheritance if our first schema is a reference, and our second is inline.
		 */
	// if (allOf.length <= 2) {
	// 	const possibleParentSchema = allOf[0]
	// 	const nextSchema = allOf[1]

	// 	const canDoSingleParentInheritance = isOpenAPIReferenceObject(possibleParentSchema) && (!nextSchema || !isOpenAPIReferenceObject(nextSchema))
	// 	if (canDoSingleParentInheritance) {
	// 		const parentSchemaUsage = toCodegenSchemaUsage(possibleParentSchema, state, {
	// 			required: true,
	// 			suggestedName: 'parent',
	// 			purpose: CodegenSchemaPurpose.MODEL,
	// 			scope,
	// 		})
	// 		const parentModel = parentSchemaUsage.schema

	// 		/* If the parent model is an interface then we cannot use it as a parent */
	// 		if (isCodegenObjectSchema(parentModel) && !parentModel.isInterface) {
	// 			model.parent = parentModel
	// 			/* We set this models native type to use the parentType from our parent's native type */
	// 			model.parentNativeType = new CodegenFullTransformingNativeTypeImpl(parentModel.nativeType, {
	// 				default: t => t.parentType,
	// 			})

	// 			allOf.shift()
	// 		}
	// 	}
	// }

	// for (const otherSchema of allOf) {
	// 	const otherModel = absorbSchema(otherSchema)
	// 	if (otherModel && otherModel.discriminator) {
	// 		/* otherModel has a discriminator so we need to add ourselves as a subtype, and now otherModel must be an interface!!!
	// 			   As we're absorbing an already constructed model, it has already found its discriminator property.
	// 			*/
	// 		const discriminatorValue = $ref && otherModel.discriminator.mappings && otherModel.discriminator.mappings[$ref] ? otherModel.discriminator.mappings[$ref] : name
	// 		const discriminatorValueLiteral = state.generator.toLiteral(discriminatorValue, {
	// 			...otherModel.discriminator,
	// 			required: true,
	// 			nullable: false,
	// 			readOnly: false,
	// 			writeOnly: false,
	// 		})
	// 		otherModel.discriminator.references.push({
	// 			model,
	// 			name: discriminatorValue,
	// 			value: discriminatorValueLiteral,
	// 		})
	// 		if (!model.discriminatorValues) {
	// 			model.discriminatorValues = []
	// 		}
	// 		model.discriminatorValues.push({
	// 			model: otherModel,
	// 			value: discriminatorValueLiteral,
	// 		})
	// 	}
	// }
		
	return model
}

function toCodegenAllOfSchemaObject(schema: OpenAPIX.SchemaObject, naming: ScopedModelInfo, $ref: string | undefined, state: InternalCodegenState): CodegenObjectSchema {
	const { scopedName, scope } = naming

	const vendorExtensions = toCodegenVendorExtensions(schema)

	const nativeType = state.generator.toNativeObjectType({
		type: 'object',
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

	const allOf = schema.allOf as Array<OpenAPIX.SchemaObject>

	/* Absorb the inline schemas */
	const inlineSchemas = allOf.filter(s => !isOpenAPIReferenceObject(s))
	for (const otherSchema of inlineSchemas) {
		absorbSchema(otherSchema, model, scope, state)
	}

	/* Create a discriminator, if appropriate, removing the discriminator property from the model's
	   properties.
	 */
	model.discriminator = toCodegenSchemaDiscriminator(schema, model, state)

	/* Handle the reference schemas, either using inheritance or interface conformance */
	const referenceSchemas = allOf.filter(isOpenAPIReferenceObject)
	if (state.generator.supportsInheritance() && (referenceSchemas.length === 1 || state.generator.supportsMultipleInheritance())) {
		/* Use parents / inheritance */
		for (const otherSchema of referenceSchemas) {
			const parentSchema = toCodegenSchemaUsage(otherSchema, state, {
				required: true,
				suggestedName: `${model.name}_parent`,
				purpose: CodegenSchemaPurpose.MODEL,
				scope,
			}).schema

			if (!isCodegenObjectSchema(parentSchema)) {
				throw new Error(`allOf "${model.name}" references a non-object schema: ${otherSchema}`)
			}

			if (!model.parents) {
				model.parents = []
			}
			model.parents.push(parentSchema)
	
			/* Add child model */
			if (!parentSchema.children) {
				parentSchema.children = []
			}
			parentSchema.children.push(model)
	
			/* Add discriminator values */
			addDiscriminatorValues(parentSchema, model, state)
		}
	} else {
		/* Absorb models and use interface conformance */
		for (const otherSchema of referenceSchemas) {
			/* We must absorb the schema from the others, and then indicate that we conform to them */
			const otherModel = absorbSchema(otherSchema, model, scope, state)
			if (!otherModel) {
				continue
			}

			/* Make sure there's an interface schema to use */
			const interfaceSchema = toCodegenInterfaceSchema(otherModel, scope, state)

			if (!model.implements) {
				model.implements = []
			}
			model.implements.push(interfaceSchema)

			if (!interfaceSchema.implementors) {
				interfaceSchema.implementors = []
			}
			interfaceSchema.implementors.push(model)

			addDiscriminatorValues(otherModel, model, state)
		}
	}

	/* We support single parent inheritance, so check if that's possible.
		   We go for single parent inheritance if our first schema is a reference, and our second is inline.
		 */
	// if (allOf.length <= 2) {
	// 	const possibleParentSchema = allOf[0]
	// 	const nextSchema = allOf[1]

	// 	const canDoSingleParentInheritance = isOpenAPIReferenceObject(possibleParentSchema) && (!nextSchema || !isOpenAPIReferenceObject(nextSchema))
	// 	if (canDoSingleParentInheritance) {
	// const parentSchemaUsage = toCodegenSchemaUsage(possibleParentSchema, state, {
	// 	required: true,
	// 	suggestedName: 'parent',
	// 	purpose: CodegenSchemaPurpose.MODEL,
	// 	scope,
	// })
	// const parentModel = parentSchemaUsage.schema

	// 		/* If the parent model is an interface then we cannot use it as a parent */
	// 		if (isCodegenObjectSchema(parentModel) && !parentModel.isInterface) {
	// 			model.parent = parentModel
	// 			/* We set this models native type to use the parentType from our parent's native type */
	// 			model.parentNativeType = new CodegenFullTransformingNativeTypeImpl(parentModel.nativeType, {
	// 				default: t => t.parentType,
	// 			})

	// 			allOf.shift()
	// 		}
	// 	}
	// }

	// for (const otherSchema of allOf) {
	// 	const otherModel = absorbSchema(otherSchema, model, scope, state)
	// 	if (otherModel && otherModel.discriminator) {
	// 		/* otherModel has a discriminator so we need to add ourselves as a subtype, and now otherModel must be an interface!!!
	// 			   As we're absorbing an already constructed model, it has already found its discriminator property.
	// 			*/
	// 		const discriminatorValue = $ref && otherModel.discriminator.mappings && otherModel.discriminator.mappings[$ref] ? otherModel.discriminator.mappings[$ref] : name
	// 		const discriminatorValueLiteral = state.generator.toLiteral(discriminatorValue, {
	// 			...otherModel.discriminator,
	// 			required: true,
	// 			nullable: false,
	// 			readOnly: false,
	// 			writeOnly: false,
	// 		})
	// 		otherModel.discriminator.references.push({
	// 			model,
	// 			name: discriminatorValue,
	// 			value: discriminatorValueLiteral,
	// 		})
	// 		if (!model.discriminatorValues) {
	// 			model.discriminatorValues = []
	// 		}
	// 		model.discriminatorValues.push({
	// 			model: otherModel,
	// 			value: discriminatorValueLiteral,
	// 		})
	// 	}
	// }

	// for (const discriminatorModel of findDiscriminatorSchemas(model.parents)) {
	// 	const discriminator = discriminatorModel.discriminator!
	// 	const discriminatorValue = ($ref && findDiscriminatorMapping(discriminator, $ref)) || model.name
	// 	const discriminatorValueLiteral = state.generator.toLiteral(discriminatorValue, {
	// 		...discriminator,
	// 		required: true,
	// 		nullable: false,
	// 		readOnly: false,
	// 		writeOnly: false,
	// 	})
	// 	if (!model.discriminatorValues) {
	// 		model.discriminatorValues = []
	// 	}
	// 	model.discriminatorValues.push({
	// 		model: discriminatorModel,
	// 		value: discriminatorValueLiteral,
	// 	})
	// 	discriminator.references.push({
	// 		model,
	// 		name: discriminatorValue,
	// 		value: discriminatorValueLiteral,
	// 	})
	// }
		
	return model
}

function addDiscriminatorValues(schema: CodegenObjectSchema, target: CodegenDiscriminatorSchema, state: InternalCodegenState) {
	const discriminatorSchemas = findDiscriminatorSchemas(schema)
	for (const aDiscriminatorSchema of discriminatorSchemas) {
		const discriminatorValue = findDiscriminatorValue(aDiscriminatorSchema.discriminator!, schema, state)
		const discriminatorValueLiteral = state.generator.toLiteral(discriminatorValue, {
			...aDiscriminatorSchema.discriminator!,
			required: true,
			nullable: false,
			readOnly: false,
			writeOnly: false,
		})
		aDiscriminatorSchema.discriminator!.references.push({
			model: target,
			name: discriminatorValue,
			value: discriminatorValueLiteral,
		})
		if (!target.discriminatorValues) {
			target.discriminatorValues = []
		}
		target.discriminatorValues.push({
			model: aDiscriminatorSchema,
			value: discriminatorValueLiteral,
		})
	}
}

function findDiscriminatorSchemas(schema: CodegenSchema): CodegenDiscriminatorSchema[] {
	const open = [schema]
	const result: CodegenDiscriminatorSchema[] = []
	for (const aSchema of open) {
		if ((aSchema as CodegenDiscriminatorSchema).discriminator) {
			result.push(aSchema as CodegenDiscriminatorSchema)
		} else if (isCodegenObjectSchema(aSchema)) {
			if (aSchema.parents) {
				open.push(...aSchema.parents.filter(s => open.indexOf(s) === -1))
			}
		} else if (isCodegenAllOfSchema(aSchema)) {
			open.push(...aSchema.composes.filter(s => open.indexOf(s) === -1))
		}
	}
	return result
}
