import { AllOfSummary, CodegenAllOfSchema, CodegenAllOfStrategy, CodegenLogLevel, CodegenObjectSchema, CodegenPropertySummary, CodegenSchemaPurpose, CodegenSchemaType, isCodegenAllOfSchema, isCodegenHierarchySchema, isCodegenInterfaceSchema, isCodegenObjectSchema } from '@openapi-generator-plus/types'
import * as idx from '@openapi-generator-plus/indexed-type'
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
import { toCodegenInterfaceImplementationSchema, createIfNotExistsCodegenInterfaceSchema } from './interface'
import { extractNaming, ScopedModelInfo } from './naming'
import { absorbCodegenSchema, absorbApiSchema } from './object-absorb'
import { addChildObjectSchema, addImplementor, addToKnownSchemas, extractCodegenSchemaCommon, finaliseSchema, findProperty } from './utils'
import { toCodegenPropertySummary, toRequiredPropertyNames } from './property'
import { transformNativeTypeForUsage } from './usage'

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
		contentMediaType: null,
		component: null,
		deprecated: false,
		examples: null,
		schemas: null,

		composes: [],
		implements: null,

		required: Array.isArray(apiSchema.required) ? apiSchema.required : null,
	}

	result.examples = toCodegenExamples(apiSchema.example, undefined, undefined, result, state)

	if (isOpenAPIv3SchemaObject(apiSchema, state.specVersion)) {
		result.deprecated = apiSchema.deprecated || false
	}

	/* Must add model to knownSchemas here before we try to load other models to avoid infinite loop
	   when a model references other models that in turn reference this model.
	 */
	result = addToKnownSchemas(apiSchema, result, naming.$ref, state)

	const allOf = apiSchema.allOf as Array<OpenAPIX.SchemaObject>
	for (const allOfApiSchema of allOf) {
		const allOfSchema = toCodegenSchemaUsage(allOfApiSchema, state, {
			purpose: CodegenSchemaPurpose.ALL_OF,
			required: false,
			suggestedScope: state.generator.nativeCompositionCanBeScope() ? result : scope,
			suggestedName: 'content',
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
	finaliseSchema(result, naming, state)
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
		contentMediaType: null,
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
	result = addToKnownSchemas(apiSchema, result, naming.$ref, state)
	
	/* Create a discriminator, if appropriate, removing the discriminator property from the schema's
	properties.
	*/
	result.discriminator = toCodegenSchemaDiscriminator(apiSchema, result, state)
	if (result.discriminator) {
		result.polymorphic = true
	}
	
	/* Handle the reference schemas, either using inheritance or interface conformance */
	for (const { apiSchema: allOfApiSchema, approach } of classifyAllOfSchemas(apiSchema, state)) {
		if (approach === SchemaApproach.PARENT) {
			const parentSchema = toCodegenSchemaUsage(allOfApiSchema, state, {
				required: true,
				suggestedName: `${result.name}_parent`,
				purpose: CodegenSchemaPurpose.ALL_OF,
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
				const interfaceSchema = isCodegenObjectSchema(allOfSchema) || isCodegenHierarchySchema(allOfSchema) ? createIfNotExistsCodegenInterfaceSchema(allOfSchema, scope, CodegenSchemaPurpose.INTERFACE, state) : allOfSchema

				if (isCodegenInterfaceSchema(interfaceSchema)) {
					addImplementor(interfaceSchema, result)
				}
			}

			const addedTo = addToAnyDiscriminators(allOfSchema, result, state)

			for (const addedToSchema of addedTo) {
				if (isCodegenHierarchySchema(addedToSchema)) {
					/* Hierarchy schemas discover their members when we find them including the hierarchy in an allOf here */
					if (addedToSchema.composes.indexOf(result) === -1) {
						addedToSchema.composes.push(result)
					}
				}
			}

			if (isCodegenHierarchySchema(allOfSchema)) {
				/* Hierarchy schemas discover their members when we find them including the hierarchy in an allOf here */
				if (allOfSchema.composes.indexOf(result) === -1) {
					allOfSchema.composes.push(result)
				}
			}
		} else {
			throw new Error(`Unsupported schema approach: ${approach}`)
		}
	}

	/* Apply required that is present on allOf, which seems to be there in OpenAPI 3.1.0 */
	if (Array.isArray(apiSchema.required) && result.properties) {
		const missingRequired: string[] = []

		for (const required of apiSchema.required) {
			const property = idx.get(result.properties, required)
			if (property) {
				/* Change the property to required in our resulting object */
				property.required = true
				property.nativeType = transformNativeTypeForUsage(property, state)
			} else {
				/* Check our inherited properties to make sure they're compatible, and correct if need be */
				const inheritedProperty = findProperty(result, required)
				if (inheritedProperty) {
					if (!inheritedProperty.required) {
						/* Add an overriding property in our result with the correct required state */
						idx.set(result.properties, required, {
							...inheritedProperty,
							required: true,
						})
					}
				} else {
					missingRequired.push(required)
				}
			}
		}

		if (missingRequired.length) {
			state.log(CodegenLogLevel.WARN, `Required property [${missingRequired.join(', ')}] missing from allOf: ${debugStringify(apiSchema)}`)
		}
	}

	loadDiscriminatorMappings(result, state)
	discoverDiscriminatorReferencesInOtherDocuments(apiSchema, state)
	finaliseSchema(result, naming, state)
	return result
}

/**
 * Classify each of the allOf schemas according to the approach that we should use to model them as object
 * relationships.
 * @param allOfSchemas the allOf schemas
 * @param state 
 * @returns 
 */
function classifyAllOfSchemas(allOfSchema: OpenAPIX.SchemaObject, state: InternalCodegenState): ClassifiedSchema[] {
	const allOfSchemas = allOfSchema.allOf as Array<OpenAPIX.SchemaObject>

	if (!checkObjectSchemaCompatibility(allOfSchema, allOfSchemas, state)) {
		/* The schemas are not compatible for inheritance or interface compatibility */
		return allOfSchemas.map(apiSchema => ({
			apiSchema,
			approach: SchemaApproach.ABSORB_NO_INTERFACE,
		}))
	}

	if (state.generator.supportsInheritance()) {
		/* An allOf does not imply hierarchy (https://swagger.io/specification/#composition-and-inheritance-polymorphism)
		   but we still prefer to use parent/child relationships to reduce the duplication of code.
		 */
		const referenceSchemas = allOfSchemas.filter(isOpenAPIReferenceObject)
		if (referenceSchemas.length === 1 || state.generator.supportsMultipleInheritance()) {
			/* Use parent/child relationships */
			return allOfSchemas.map(apiSchema => ({
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
			return allOfSchemas.map(apiSchema => ({
				apiSchema,
				approach: apiSchema === discriminatorSchemas[0] ? SchemaApproach.PARENT : SchemaApproach.ABSORB_WITH_INTERFACE,
			}))
		}
	}

	/* If we can't find any inheritance possibilties we just absorb all of the schemas */
	return allOfSchemas.map(apiSchema => ({
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
 * @param allOfSchemas 
 * @param state 
 * @returns 
 */
function checkObjectSchemaCompatibility(allOfSchema: OpenAPIX.SchemaObject, allOfSchemas: OpenAPIX.SchemaObject[], state: InternalCodegenState, allOfSummary?: AllOfSummary): boolean {
	if (!allOfSummary) {
		allOfSummary = {
			properties: {},
			allProperties: {},
			discriminators: [],
			schemas: [],
			referenceSchemas: [],
			inlineSchemas: [],
			required: [],
		}
	}

	const allOfRequired = toRequiredPropertyNames(allOfSchema)
	allOfSummary.required = allOfSummary.required.concat(allOfRequired)

	for (let apiSchema of allOfSchemas) {
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
			if (!checkObjectSchemaCompatibility(apiSchema, apiSchema.allOf, state, allOfSummary)) {
				return false
			}
		}

		if (!apiSchema.properties) {
			continue
		}

		for (const apiPropertyName of idx.allKeys(apiSchema.properties)) {
			let apiProperty: OpenAPIX.SchemaObject = apiSchema.properties[apiPropertyName]
			if (isOpenAPIReferenceObject(apiProperty)) {
				apiProperty = resolveReference(apiProperty, state)
			}

			const required = toRequiredPropertyNames(apiSchema).indexOf(apiPropertyName) !== -1
			allOfSummary.allProperties[apiPropertyName] = { schema: apiProperty, required }

			if (!allOfSummary.properties[apiPropertyName]) {
				/* We're only concerned about compatibility with properties in referenced schemas, as they are
				   the only ones that may be turned into objects in the target language.
				 */
				if (referenceSchema) {
					allOfSummary.properties[apiPropertyName] = { schema: apiProperty, required }
				}
			} else {
				/* Check compatibility */
				const knownProperty = allOfSummary.properties[apiPropertyName]
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

	/* Check allOf's required, if any */
	if (allOfRequired.length) {
		for (const propertyName of allOfRequired) {
			const knownProperty = allOfSummary.properties[propertyName]
			if (knownProperty) {
				if (!checkPropertyCompatibility(
					toCodegenPropertySummary(propertyName, knownProperty.schema, knownProperty.required),
					toCodegenPropertySummary(propertyName, knownProperty.schema, true),
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
