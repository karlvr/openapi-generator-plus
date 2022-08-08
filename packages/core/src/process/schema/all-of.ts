import { AllOfSummary, CodegenAllOfSchema, CodegenAllOfStrategy, CodegenObjectSchema, CodegenPropertySummary, CodegenSchemaPurpose, CodegenSchemaType, isCodegenAllOfSchema, isCodegenHierarchySchema, isCodegenInterfaceSchema, isCodegenObjectSchema } from '@openapi-generator-plus/types'
import { toCodegenSchemaUsage } from '.'
import { debugStringify } from '@openapi-generator-plus/utils'
import { isOpenAPIReferenceObject, isOpenAPIv3SchemaObject } from '../../openapi-type-guards'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { toCodegenExamples } from '../examples'
import { toCodegenExternalDocs } from '../external-docs'
import { resolveReference } from '../utils'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { addToAnyDiscriminators, discoverDiscriminatorReferencesInOtherDocuments, loadDiscriminatorMappings, toCodegenSchemaDiscriminator } from './discriminator'
import { toCodegenInterfaceImplementationSchema, toCodegenInterfaceSchema } from './interface'
import { extractNaming, ScopedModelInfo } from './naming'
import { absorbCodegenSchema, absorbApiSchema } from './object-absorb'
import { addChildObjectSchema, addImplementor, addToKnownSchemas, extractCodegenSchemaCommon } from './utils'
import { toCodegenPropertySummary, toRequiredPropertyNames } from './property'

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
	discoverDiscriminatorReferencesInOtherDocuments(apiSchema, state)
		
	return result
}

enum SchemaApproach {
	/** Use inheritance */
	PARENT,
	/** Absorb the schema and use interface conformance */
	ABSORB_WITH_INTERFACE,
	/** Absorb the schema with no interface conformance */
	ABSORB_NO_INTERFACE,
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
		} else if (approach === SchemaApproach.ABSORB_WITH_INTERFACE || approach === SchemaApproach.ABSORB_NO_INTERFACE) {
			/* We must absorb the schema from the others, and then indicate that we conform to them */
			const allOfSchema = absorbApiSchema(allOfApiSchema, result, scope, state)
			if (!allOfSchema) {
				continue
			}

			if (approach === SchemaApproach.ABSORB_WITH_INTERFACE) {
				/* Make sure there's an interface schema to use */
				const interfaceSchema = isCodegenObjectSchema(allOfSchema) || isCodegenHierarchySchema(allOfSchema) ? toCodegenInterfaceSchema(allOfSchema, scope, state) : allOfSchema

				if (isCodegenInterfaceSchema(interfaceSchema)) {
					addImplementor(interfaceSchema, result)
				}
			}

			addToAnyDiscriminators(allOfSchema, result, state)

			if (isCodegenHierarchySchema(allOfSchema)) {
				/* Hierarchy schemas discover their members when we find them including the hierarchy in an allOf here */
				allOfSchema.composes.push(result)
			}
		} else {
			throw new Error(`Unsupported schema approach: ${approach}`)
		}
	}

	loadDiscriminatorMappings(result, state)
	discoverDiscriminatorReferencesInOtherDocuments(apiSchema, state)

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
	if (!checkObjectSchemaCompatibility(allOf, state)) {
		/* The schemas are not compatible for inheritance or interface compatibility */
		return allOf.map(apiSchema => ({
			apiSchema,
			approach: SchemaApproach.ABSORB_NO_INTERFACE,
		}))
	}

	if (state.generator.supportsInheritance()) {
		/* An allOf does not imply hierarchy (https://swagger.io/specification/#composition-and-inheritance-polymorphism)
		   but we still prefer to use parent/child relationships to reduce the duplication of code.
		 */
		const referenceSchemas = allOf.filter(isOpenAPIReferenceObject)
		if (referenceSchemas.length === 1 || state.generator.supportsMultipleInheritance()) {
			/* Use parent/child relationships */
			return allOf.map(apiSchema => ({
				apiSchema,
				approach: isOpenAPIReferenceObject(apiSchema) ? SchemaApproach.PARENT : SchemaApproach.ABSORB_WITH_INTERFACE,
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
				approach: apiSchema === discriminatorSchemas[0] ? SchemaApproach.PARENT : SchemaApproach.ABSORB_WITH_INTERFACE,
			}))
		}
	}

	/* If we can't find any inheritance possibilties we just absorb all of the schemas */
	return allOf.map(apiSchema => ({
		apiSchema,
		approach: SchemaApproach.ABSORB_WITH_INTERFACE,
	}))
}

/**
 * Check that the properties of the schemas are compatible with each other, otherwise we cannot use inheritance
 * as languages do not allow inheritance with incompatible property types.
 * <p>
 * Note we check that reference schema properties are compatible with each other and with our non-reference schemas,
 * as non-reference (inline) schemas are not generated as objects in the output and can therefore override 
 * each other.
 * 
 * @param allOf 
 * @param state 
 * @returns 
 */
function checkObjectSchemaCompatibility(allOf: OpenAPIX.SchemaObject[], state: InternalCodegenState, allOfSummary?: AllOfSummary): boolean {
	if (!allOfSummary) {
		allOfSummary = {
			properties: {},
			discriminators: [],
			schemas: [],
			referenceSchemas: [],
			inlineSchemas: [],
		}
	}

	for (let apiSchema of allOf) {
		let referenceSchema = false
		if (isOpenAPIReferenceObject(apiSchema)) {
			apiSchema = resolveReference(apiSchema, state)
			referenceSchema = true
		}

		allOfSummary.schemas.push(apiSchema)
		if (referenceSchema) {
			allOfSummary.referenceSchemas.push(apiSchema)
		} else {
			allOfSummary.inlineSchemas.push(apiSchema)
		}

		if (apiSchema.discriminator) {
			allOfSummary.discriminators.push(apiSchema.discriminator.propertyName)
		}

		if (apiSchema.allOf) {
			if (!checkObjectSchemaCompatibility(apiSchema.allOf, state, allOfSummary)) {
				return false
			}
		}

		if (!apiSchema.properties) {
			continue
		}

		for (const apiPropertyName of Object.keys(apiSchema.properties)) {
			let apiProperty: OpenAPIX.SchemaObject = apiSchema.properties[apiPropertyName]
			if (isOpenAPIReferenceObject(apiProperty)) {
				apiProperty = resolveReference(apiProperty, state)
			}

			if (!allOfSummary.properties[apiPropertyName]) {
				/* We're only concerned about compatibility with properties in referenced schemas, as they are
				   the only ones that may be turned into objects in the target language.
				 */
				if (referenceSchema) {
					const required = toRequiredPropertyNames(apiSchema).indexOf(apiPropertyName) !== -1
					allOfSummary.properties[apiPropertyName] = { schema: apiProperty, required }
				}
			} else {
				/* Check compatibility */
				const knownProperty = allOfSummary.properties[apiPropertyName]
				const required = toRequiredPropertyNames(apiSchema).indexOf(apiPropertyName) !== -1
				if (!checkPropertyCompatibility(
					toCodegenPropertySummary(apiPropertyName, knownProperty.schema, knownProperty.required),
					toCodegenPropertySummary(apiPropertyName, apiProperty, required),
					state
				)) {
					return false
				}
			}
		}
	}

	/* There may still be incompatibilities in the schemas for the generator's target, so we give the generator an opportunity to check. */
	return state.generator.checkAllOfInheritanceCompatibility(allOfSummary)
}

/**
 * Check that two property schemas are compatible so that one can override the other in an
 * inheritance hierarchy.
 * @param parentProp 
 * @param childProp 
 * @returns 
 */
function checkPropertyCompatibility(parentProp: CodegenPropertySummary, childProp: CodegenPropertySummary, state: InternalCodegenState): boolean {
	return state.generator.checkPropertyCompatibility(parentProp, childProp)
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
