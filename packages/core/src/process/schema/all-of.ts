import { CodegenAllOfSchema, CodegenAllOfStrategy, CodegenObjectSchema, CodegenSchemaPurpose, CodegenSchemaType, isCodegenInterfaceSchema, isCodegenObjectLikeSchema, isCodegenObjectSchema } from '@openapi-generator-plus/types'
import { toCodegenSchemaUsage } from '.'
import { isOpenAPIReferenceObject, isOpenAPIv3SchemaObject } from '../../openapi-type-guards'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { toCodegenExamples } from '../examples'
import { toCodegenExternalDocs } from '../external-docs'
import { resolveReference } from '../utils'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { addToAnyDiscriminators, loadDiscriminatorMappings, toCodegenSchemaDiscriminator } from './discriminator'
import { toCodegenInterfaceImplementationSchema, toCodegenInterfaceSchema } from './interface'
import { extractNaming, ScopedModelInfo } from './naming'
import { absorbModel, absorbSchema } from './object-absorb'
import { addChildObjectSchema, addImplementor, addToKnownSchemas, extractCodegenSchemaCommon } from './utils'

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
		polymorphic: false,
		vendorExtensions,
		externalDocs: toCodegenExternalDocs(schema),
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
			suggestedName: `${model.name}_content`,
		}).schema

		if (!isCodegenObjectLikeSchema(otherModel)) {
			throw new Error(`allOf "${model.name}" references a non-object (${otherModel.schemaType}) schema: ${JSON.stringify(otherSchema)}`)
		}

		model.composes.push(otherModel)
		addToAnyDiscriminators(otherModel, model, state)
	}

	model.discriminator = toCodegenSchemaDiscriminator(schema, model)
	if (model.discriminator) {
		model.polymorphic = true
	}
	loadDiscriminatorMappings(model, state)
		
	return model
}

enum SchemaApproach {
	PARENT,
	ABSORB,
}
interface ClassifiedSchema {
	schema: OpenAPIX.SchemaObject
	approach: SchemaApproach
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

		abstract: false,
		discriminator: null,
		discriminatorValues: null,
		polymorphic: false,
		vendorExtensions,
		externalDocs: toCodegenExternalDocs(schema),
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

	
	/* Create a discriminator, if appropriate, removing the discriminator property from the model's
	properties.
	*/
	model.discriminator = toCodegenSchemaDiscriminator(schema, model)
	if (model.discriminator) {
		model.polymorphic = true
	}
	
	/* Handle the reference schemas, either using inheritance or interface conformance */
	const allOf = schema.allOf as Array<OpenAPIX.SchemaObject>
	for (const { schema: otherSchema, approach } of classifyAllOfSchemas(allOf, state)) {
		if (approach === SchemaApproach.PARENT) {
			const parentSchema = toCodegenSchemaUsage(otherSchema, state, {
				required: true,
				suggestedName: `${model.name}_parent`,
				purpose: CodegenSchemaPurpose.MODEL,
				scope,
			}).schema

			if (isCodegenObjectSchema(parentSchema)) {
				addChildObjectSchema(parentSchema, model)
			} else if (isCodegenInterfaceSchema(parentSchema)) {
				const parentImplementation = toCodegenInterfaceImplementationSchema(parentSchema, state)
				if (parentImplementation) {
					addChildObjectSchema(parentImplementation, model)
				} else {
					/* If we can't create an implementation containing all of the parent's properties, we must absorb and have the properties ourselves */
					absorbModel(parentSchema, model)
					addImplementor(parentSchema, model)
				}
			} else {
				throw new Error(`allOf "${model.name}" references a non-object-like schema: ${parentSchema.schemaType}`)
			}
	
			/* Add discriminator values */
			addToAnyDiscriminators(parentSchema, model, state)
		} else {
			/* We must absorb the schema from the others, and then indicate that we conform to them */
			const otherModel = absorbSchema(otherSchema, model, scope, state)
			if (!otherModel) {
				continue
			}

			/* Make sure there's an interface schema to use */
			const interfaceSchema = isCodegenObjectSchema(otherModel) ? toCodegenInterfaceSchema(otherModel, scope, state) : otherModel

			addImplementor(interfaceSchema, model)
			addToAnyDiscriminators(otherModel, model, state)
		}
	}

	loadDiscriminatorMappings(model, state)
	
	return model
}

/**
 * Classify each of the allOf schemas according to the approach that we should use to model them as object
 * relationships.
 * @param allOf the allOf schemas
 * @param state 
 * @returns 
 */
function classifyAllOfSchemas(allOf: OpenAPIX.SchemaObject[], state: InternalCodegenState): ClassifiedSchema[] {
	if (state.generator.supportsInheritance()) {
		/* An allOf does not imply hierarchy (https://swagger.io/specification/#composition-and-inheritance-polymorphism)
		   but we still prefer to use parent/child relationships to reduce the duplication of code.
		 */
		const referenceSchemas = allOf.filter(isOpenAPIReferenceObject)
		if (referenceSchemas.length === 1 || state.generator.supportsMultipleInheritance()) {
			/* Use parent/child relationships */
			return allOf.map(schema => ({
				schema,
				approach: isOpenAPIReferenceObject(schema) ? SchemaApproach.PARENT : SchemaApproach.ABSORB,
			}))
		}

		/* A discriminator _does_ imply hierarchy (https://swagger.io/specification/#composition-and-inheritance-polymorphism)
		   so if we can't use parent/child relationships above because there are too many possible parents, then we
		   check if only one of those schemas is a discriminator hierarchy and we choose that as the parent.
		 */
		const discriminatorSchemas = referenceSchemas.filter(schema => hasDiscriminator(schema, state))
		if (discriminatorSchemas.length === 1) {
			/* Use parent/child relationship with just the discriminator schema */
			return allOf.map(schema => ({
				schema,
				approach: schema === discriminatorSchemas[0] ? SchemaApproach.PARENT : SchemaApproach.ABSORB,
			}))
		}
	}

	/* If we can't find any inheritance possibilties we just absorb all of the schemas */
	return allOf.map(schema => ({
		schema,
		approach: SchemaApproach.ABSORB,
	}))
}

function hasDiscriminator(schema: OpenAPIX.SchemaObject, state: InternalCodegenState): boolean {
	schema = resolveReference(schema, state)
	if (schema.discriminator) {
		return true
	}
	if (schema.allOf) {
		for (const aSchema of schema.allOf) {
			if (hasDiscriminator(aSchema, state)) {
				return true
			}
		}
	}
	return false
}
