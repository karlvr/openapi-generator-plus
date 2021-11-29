import { CodegenAllOfSchema, CodegenAllOfStrategy, CodegenObjectSchema, CodegenSchemaPurpose, CodegenSchemaType, isCodegenAllOfSchema, isCodegenCompositionSchema, isCodegenHierarchySchema, isCodegenInterfaceSchema, isCodegenObjectLikeSchema, isCodegenObjectSchema } from '@openapi-generator-plus/types'
import { toCodegenSchemaUsage } from '.'
import { debugStringify } from '../../stringify'
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
import { absorbCodegenSchema, absorbApiSchema } from './object-absorb'
import { addChildObjectSchema, addImplementor, addToKnownSchemas, extractCodegenSchemaCommon } from './utils'

export function toCodegenAllOfSchema(apiSchema: OpenAPIX.SchemaObject, naming: ScopedModelInfo, state: InternalCodegenState): CodegenAllOfSchema | CodegenObjectSchema {
	const strategy = state.generator.allOfStrategy()
	switch (strategy) {
		case CodegenAllOfStrategy.NATIVE:
			return toCodegenAllOfSchemaNative(apiSchema, naming, state)
		case CodegenAllOfStrategy.OBJECT:
		case CodegenAllOfStrategy.HIERARCHY:
			return toCodegenAllOfSchemaObject(apiSchema, naming, state)
	}
	throw new Error(`Unsupported allOf strategy: ${strategy}`)
}

function toCodegenAllOfSchemaNative(apiSchema: OpenAPIX.SchemaObject, naming: ScopedModelInfo, state: InternalCodegenState): CodegenAllOfSchema {
	const { scopedName, scope } = naming

	const vendorExtensions = toCodegenVendorExtensions(apiSchema)

	const nativeType = state.generator.toNativeObjectType({
		type: 'object',
		schemaType: CodegenSchemaType.ALLOF,
		scopedName,
		vendorExtensions,
	})

	let result: CodegenAllOfSchema = {
		...extractNaming(naming),
		...extractCodegenSchemaCommon(apiSchema, state),

		discriminator: null,
		discriminatorValues: null,
		polymorphic: false,
		vendorExtensions,
		externalDocs: toCodegenExternalDocs(apiSchema),
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

	result.examples = toCodegenExamples(apiSchema.example, undefined, undefined, result, state)

	if (isOpenAPIv3SchemaObject(apiSchema, state.specVersion)) {
		result.deprecated = apiSchema.deprecated || false
	}

	/* Must add model to knownSchemas here before we try to load other models to avoid infinite loop
	   when a model references other models that in turn reference this model.
	 */
	result = addToKnownSchemas(apiSchema, result, naming, state)

	const allOf = apiSchema.allOf as Array<OpenAPIX.SchemaObject>
	for (const allOfApiSchema of allOf) {
		const allOfSchema = toCodegenSchemaUsage(allOfApiSchema, state, {
			purpose: CodegenSchemaPurpose.GENERAL,
			required: false,
			suggestedScope: state.generator.nativeCompositionCanBeScope() ? result : scope,
			suggestedName: 'content',
			nameRequired: state.generator.nativeComposedSchemaRequiresName(),
		}).schema

		if (!isCodegenObjectSchema(allOfSchema) && !isCodegenInterfaceSchema(allOfSchema) && !isCodegenAllOfSchema(allOfSchema)) {
			throw new Error(`allOf "${result.name}" references a non-object (${allOfSchema.schemaType}) schema: ${debugStringify(allOfApiSchema)}`)
		}

		result.composes.push(allOfSchema)
		addToAnyDiscriminators(allOfSchema, result, state)
	}

	result.discriminator = toCodegenSchemaDiscriminator(apiSchema, result, state)
	if (result.discriminator) {
		result.polymorphic = true
	}
	loadDiscriminatorMappings(result, state)
		
	return result
}

enum SchemaApproach {
	PARENT,
	ABSORB,
}
interface ClassifiedSchema {
	apiSchema: OpenAPIX.SchemaObject
	approach: SchemaApproach
}

function toCodegenAllOfSchemaObject(apiSchema: OpenAPIX.SchemaObject, naming: ScopedModelInfo, state: InternalCodegenState): CodegenObjectSchema {
	const { scopedName, scope } = naming

	const vendorExtensions = toCodegenVendorExtensions(apiSchema)

	const nativeType = state.generator.toNativeObjectType({
		type: 'object',
		schemaType: CodegenSchemaType.OBJECT,
		scopedName,
		vendorExtensions,
	})

	let result: CodegenObjectSchema = {
		...extractNaming(naming),
		...extractCodegenSchemaCommon(apiSchema, state),

		abstract: false,
		discriminator: null,
		discriminatorValues: null,
		polymorphic: false,
		vendorExtensions,
		externalDocs: toCodegenExternalDocs(apiSchema),
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

	result.examples = toCodegenExamples(apiSchema.example, undefined, undefined, result, state)

	if (isOpenAPIv3SchemaObject(apiSchema, state.specVersion)) {
		result.deprecated = apiSchema.deprecated || false
	}

	/* Must add model to knownSchemas here before we try to load other models to avoid infinite loop
	   when a model references other models that in turn reference this model.
	 */
	result = addToKnownSchemas(apiSchema, result, naming, state)
	
	/* Create a discriminator, if appropriate, removing the discriminator property from the schema's
	properties.
	*/
	result.discriminator = toCodegenSchemaDiscriminator(apiSchema, result, state)
	if (result.discriminator) {
		result.polymorphic = true
	}
	
	/* Handle the reference schemas, either using inheritance or interface conformance */
	const allOf = apiSchema.allOf as Array<OpenAPIX.SchemaObject>
	for (const { apiSchema: allOfApiSchema, approach } of classifyAllOfSchemas(allOf, state)) {
		if (approach === SchemaApproach.PARENT) {
			const parentSchema = toCodegenSchemaUsage(allOfApiSchema, state, {
				required: true,
				suggestedName: `${result.name}_parent`,
				purpose: CodegenSchemaPurpose.GENERAL,
				suggestedScope: scope,
			}).schema

			if (isCodegenObjectSchema(parentSchema)) {
				addChildObjectSchema(parentSchema, result)
			} else if (isCodegenInterfaceSchema(parentSchema)) {
				const parentImplementation = toCodegenInterfaceImplementationSchema(parentSchema, { allowAbstract: true }, state)
				if (parentImplementation) {
					addChildObjectSchema(parentImplementation, result)
				} else {
					/* If we can't create an implementation containing all of the parent's properties, we must absorb and have the properties ourselves */
					absorbCodegenSchema(parentSchema, result)
					addImplementor(parentSchema, result)
				}
			} else {
				throw new Error(`allOf "${result.name}" references a non-object-like schema: ${parentSchema.schemaType}`)
			}
	
			/* Add discriminator values */
			addToAnyDiscriminators(parentSchema, result, state)
		} else {
			/* We must absorb the schema from the others, and then indicate that we conform to them */
			const allOfSchema = absorbApiSchema(allOfApiSchema, result, scope, state)
			if (!allOfSchema) {
				continue
			}

			/* Make sure there's an interface schema to use */
			const interfaceSchema = isCodegenObjectSchema(allOfSchema) || isCodegenHierarchySchema(allOfSchema) ? toCodegenInterfaceSchema(allOfSchema, scope, state) : allOfSchema

			if (isCodegenInterfaceSchema(interfaceSchema)) {
				addImplementor(interfaceSchema, result)
			}
			addToAnyDiscriminators(allOfSchema, result, state)

			if (isCodegenHierarchySchema(allOfSchema)) {
				/* Hierarchy schemas discover their members when we find them including the hierarchy in an allOf here */
				allOfSchema.composes.push(result)
			}
		}
	}

	loadDiscriminatorMappings(result, state)
	
	return result
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
			return allOf.map(apiSchema => ({
				apiSchema,
				approach: isOpenAPIReferenceObject(apiSchema) ? SchemaApproach.PARENT : SchemaApproach.ABSORB,
			}))
		}

		/* A discriminator _does_ imply hierarchy (https://swagger.io/specification/#composition-and-inheritance-polymorphism)
		   so if we can't use parent/child relationships above because there are too many possible parents, then we
		   check if only one of those schemas is a discriminator hierarchy and we choose that as the parent.
		 */
		const discriminatorSchemas = referenceSchemas.filter(schema => hasDiscriminator(schema, state))
		if (discriminatorSchemas.length === 1) {
			/* Use parent/child relationship with just the discriminator schema */
			return allOf.map(apiSchema => ({
				apiSchema,
				approach: apiSchema === discriminatorSchemas[0] ? SchemaApproach.PARENT : SchemaApproach.ABSORB,
			}))
		}
	}

	/* If we can't find any inheritance possibilties we just absorb all of the schemas */
	return allOf.map(apiSchema => ({
		apiSchema,
		approach: SchemaApproach.ABSORB,
	}))
}

function hasDiscriminator(apiSchema: OpenAPIX.SchemaObject, state: InternalCodegenState): boolean {
	apiSchema = resolveReference(apiSchema, state)
	if (apiSchema.discriminator) {
		return true
	}
	if (apiSchema.allOf) {
		for (const allOfApiSchema of apiSchema.allOf) {
			if (hasDiscriminator(allOfApiSchema, state)) {
				return true
			}
		}
	}
	return false
}
