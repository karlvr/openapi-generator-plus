import { CodegenAllOfSchema, CodegenDiscriminatableSchema, CodegenDiscriminator, CodegenDiscriminatorMappings, CodegenDiscriminatorReference, CodegenDiscriminatorSchema, CodegenNamedSchema, CodegenObjectSchema, CodegenProperty, CodegenSchema, CodegenSchemaPurpose, CodegenSchemaUsage, isCodegenAllOfSchema, isCodegenAnyOfSchema, isCodegenDiscriminatorSchema, isCodegenHierarchySchema, isCodegenInterfaceSchema, isCodegenObjectLikeSchema, isCodegenObjectSchema, isCodegenOneOfSchema, isCodegenScope } from '@openapi-generator-plus/types'
import { OpenAPIV3 } from 'openapi-types'
import { discoverSchemasInOtherDocuments, DiscoverSchemasTestFunc, toCodegenSchemaUsage } from '.'
import * as idx from '@openapi-generator-plus/indexed-type'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { equalCodegenTypeInfo, extractCodegenSchemaUsage, resolveReference, toCodegenDefaultValueOptions, typeInfoToString } from '../utils'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { baseSuggestedNameForRelatedSchemas, findKnownSchema, findProperty, interfaceForProperty, removeProperty } from './utils'

/**
 * Create a CodegenDiscriminator for the given schema, to be put into the target
 * @param apiSchema the schema containing the discriminator
 * @param target the CodegenDiscriminatorSchema where the discriminator will go 
 * @param state 
 * @returns 
 */
export function toCodegenSchemaDiscriminator(apiSchema: OpenAPIX.SchemaObject, target: CodegenDiscriminatorSchema, state: InternalCodegenState): CodegenDiscriminator | null {
	if (!apiSchema.discriminator) {
		return null
	}

	let schemaDiscriminator = apiSchema.discriminator as string | OpenAPIV3.DiscriminatorObject
	if (typeof schemaDiscriminator === 'string') {
		/* OpenAPIv2 support */
		const vendorExtensions = toCodegenVendorExtensions(apiSchema)

		schemaDiscriminator = {
			propertyName: schemaDiscriminator,
			/* Note that we support a vendor extension here to allow mappings in OpenAPI v2 specs */
			mapping: vendorExtensions ? vendorExtensions['x-discriminator-mapping'] as Record<string, string> : undefined,
		}
	}

	let discriminatorType: CodegenSchemaUsage | undefined = undefined
	if (isCodegenObjectSchema(target) || isCodegenHierarchySchema(target)) {
		const discriminatorProperty = findProperty(target, schemaDiscriminator.propertyName)
		if (!discriminatorProperty) {
			throw new Error(`Discriminator property "${schemaDiscriminator.propertyName}" missing from "${target.name}"`)
		}

		discriminatorType = extractCodegenSchemaUsage(discriminatorProperty)
	} else if (isCodegenAnyOfSchema(target) || isCodegenOneOfSchema(target)) {
		/* For an anyOf or oneOf schemas we have to look in their composes to find the property */
		discriminatorType = findCommonDiscriminatorPropertyType(schemaDiscriminator.propertyName, target.composes, target)
	} else if (isCodegenInterfaceSchema(target)) {
		/* First check if the interface has the property, which is the case if it's the root of an allOf */
		const discriminatorProperty = findProperty(target, schemaDiscriminator.propertyName)
		if (discriminatorProperty) {
			discriminatorType = extractCodegenSchemaUsage(discriminatorProperty)
		} else {
			/* Or for a oneOf interface, look in its implementors */
			discriminatorType = findCommonDiscriminatorPropertyType(schemaDiscriminator.propertyName, target.implementors || [], target)
		}
	} else {
		throw new Error(`Unsupported schema type for discriminator: ${target.schemaType}`)
	}

	const result: CodegenDiscriminator = {
		name: state.generator.toIdentifier(schemaDiscriminator.propertyName),
		serializedName: schemaDiscriminator.propertyName,
		mappings: toCodegenDiscriminatorMappings(schemaDiscriminator),
		references: [],
		...discriminatorType,
	}

	return result
}

/**
 * Make sure we load any models referenced by the discriminator, as they may not be
 * in our components/schemas that we load automatically, such as when they're in external
 * documents.
 * 
 * NOTE: this is separated from toCodegenSchemaDiscriminator as we must not load additional schemas
 *       until the schema has its own discriminator set, otherwise we will not be able to find and add
 *       new schemas to the discriminator.
 */
export function loadDiscriminatorMappings(schema: CodegenDiscriminatorSchema, state: InternalCodegenState): void {
	if (!schema.discriminator || !schema.discriminator.mappings) {
		return
	}

	for (const mappingRef of Object.keys(schema.discriminator.mappings)) {
		toCodegenSchemaUsage({ $ref: mappingRef }, state, {
			required: false,
			suggestedName: `${schema.name}`,
			purpose: CodegenSchemaPurpose.GENERAL,
			suggestedScope: isCodegenScope(schema) ? schema : null,
		})
	}
}

function toCodegenDiscriminatorMappings(discriminator: OpenAPIV3.DiscriminatorObject): CodegenDiscriminatorMappings | null {
	if (!discriminator.mapping) {
		return null
	}

	const schemaMappings: CodegenDiscriminatorMappings = {}
	for (const mapping in discriminator.mapping) {
		const ref = discriminator.mapping[mapping]
		schemaMappings[ref] = mapping
	}
	return schemaMappings
}

function findDiscriminatorPropertyInObjectSchema(serializedName: string, schema: CodegenObjectSchema): CodegenProperty | undefined {
	if (schema.properties) {
		const property = idx.get(schema.properties, serializedName)
		if (property) {
			return property
		}
	}
	if (schema.parents) {
		for (const parent of schema.parents) {
			const property = findDiscriminatorPropertyInObjectSchema(serializedName, parent)
			if (property !== undefined) {
				return property
			}
		}
	}

	return undefined
}

function findDiscriminatorPropertyInAllOfSchema(serializedName: string, schema: CodegenAllOfSchema): CodegenProperty | undefined {
	const n = schema.composes.length
	for (let i = n - 1; i >= 0; i--) {
		const composedSchema = schema.composes[i]
		if (isCodegenObjectSchema(composedSchema)) {
			const property = findDiscriminatorPropertyInObjectSchema(serializedName, composedSchema)
			if (property !== undefined) {
				return property
			}
		} else if (isCodegenAllOfSchema(composedSchema)) {
			const property = findDiscriminatorPropertyInAllOfSchema(serializedName, composedSchema)
			if (property !== undefined) {
				return property
			}
		}
	}
	return undefined
}

/**
 * Find the common discriminator property type for a named discimrinator property across a collection of schemas.
 * @param serializedName the serialized name of the property
 * @param schemas the schemas to look for the property in
 * @param container the container of the discriminator property
 * @returns 
 */
function findCommonDiscriminatorPropertyType(serializedName: string, schemas: CodegenSchema[], container: CodegenNamedSchema): CodegenSchemaUsage {
	let result: CodegenSchemaUsage | undefined = undefined
	for (const schema of schemas) {
		let property: CodegenProperty | undefined
		if (isCodegenObjectSchema(schema)) {
			property = findDiscriminatorPropertyInObjectSchema(serializedName, schema)
		} else if (isCodegenAllOfSchema(schema)) {
			property = findDiscriminatorPropertyInAllOfSchema(serializedName, schema)
		} else {
			throw new Error(`Found unexpected schema type (${schema.schemaType}) when looking for discriminator property "${serializedName}" for "${container.name}"`)
		}

		if (property === undefined) {
			throw new Error(`Discriminator property "${serializedName}" for "${container.name}" missing in "${schema.name}"`)
		}
		const propertyType = extractCodegenSchemaUsage(property)
		if (result === undefined) {
			result = propertyType
		} else if (!equalCodegenTypeInfo(result, propertyType)) {
			throw new Error(`Found mismatching type for discriminator property "${serializedName}" for "${container.name}" in "${schema.name}": ${typeInfoToString(propertyType)} vs ${typeInfoToString(result)}`)
		}
	}
	if (!result) {
		throw new Error(`Discriminator property "${serializedName}" missing from all schemas for "${container.name}"`)
	}
	return result
}

/**
 * Return the appropriate discriminator value to use for the given schema
 * @param discriminator the discriminator
 * @param schema the discriminatable schema to find the value for
 * @returns 
 */
function discriminatorValueForSchema(discriminator: CodegenDiscriminator, schema: CodegenDiscriminatableSchema, state: InternalCodegenState): string {
	const name = baseSuggestedNameForRelatedSchemas(schema)
	if (!discriminator.mappings) {
		return name
	}
	
	for (const [$ref, value] of idx.iterable(discriminator.mappings)) {
		const resolvedSchema = resolveReference({
			$ref,
		}, state)
		const found = findKnownSchema(resolvedSchema, $ref, state)
		if (found === schema) {
			return value
		}
	}

	return name
}

/**
 * Add a new member to the discriminator in the discriminatorSchema.
 * @param discriminatorSchema 
 * @param memberSchema 
 * @param state 
 * @returns 
 */
export function addToDiscriminator(discriminatorSchema: CodegenDiscriminatorSchema, memberSchema: CodegenDiscriminatableSchema, state: InternalCodegenState): void {
	if (!discriminatorSchema.discriminator) {
		return
	}

	/* Check if we've already added this memberSchema */
	if (discriminatorSchema.discriminator.references.find(r => r.schema === memberSchema)) {
		return
	}

	if (isCodegenObjectLikeSchema(memberSchema)) {
		const property = findProperty(memberSchema, discriminatorSchema.discriminator.serializedName)
		if (!property) {
			throw new Error(`Discriminator property "${discriminatorSchema.discriminator.serializedName}" for "${discriminatorSchema.name}" missing from "${memberSchema.name}"`)
		}

		if (!property.discriminators) {
			property.discriminators = []
		}
		property.discriminators.push(discriminatorSchema.discriminator)
	}
	
	const discriminatorValue = discriminatorValueForSchema(discriminatorSchema.discriminator, memberSchema, state)
	const discriminatorValueLiteral = state.generator.toLiteral(discriminatorValue, toCodegenDefaultValueOptions({
		...discriminatorSchema.discriminator,
		required: true,
		nullable: false,
		readOnly: false,
		writeOnly: false,
	}))
	if (!discriminatorValueLiteral) {
		throw new Error(`Discriminator value "${discriminatorValue}" cannot be converted to literal for property "${discriminatorSchema.discriminator.serializedName}" in "${memberSchema.name}"`)
	}
	discriminatorSchema.discriminator.references.push({
		schema: memberSchema,
		value: discriminatorValue,
		literalValue: discriminatorValueLiteral,
	})
	if (!memberSchema.discriminatorValues) {
		memberSchema.discriminatorValues = []
	}
	memberSchema.discriminatorValues.push({
		schema: discriminatorSchema,
		value: discriminatorValue,
		literalValue: discriminatorValueLiteral,
	})
}

/**
 * Find any discriminators in the parent, and add the target to those discriminators
 * @param parent 
 * @param target 
 * @param state 
 */
export function addToAnyDiscriminators(parent: CodegenSchema, target: CodegenDiscriminatableSchema, state: InternalCodegenState): void {
	const discriminatorSchemas = findDiscriminatorSchemas(parent)
	for (const aDiscriminatorSchema of discriminatorSchemas) {
		addToDiscriminator(aDiscriminatorSchema, target, state)
	}
}

/**
 * Find any schemas with discriminators in the given schema and its parents
 * @param schema 
 * @returns 
 */
function findDiscriminatorSchemas(schema: CodegenSchema): CodegenDiscriminatorSchema[] {
	const open = [schema]
	const result: CodegenDiscriminatorSchema[] = []
	for (const aSchema of open) {
		if (isCodegenDiscriminatorSchema(aSchema) && aSchema.discriminator) {
			result.push(aSchema as CodegenDiscriminatorSchema)
		}
		if (isCodegenObjectSchema(aSchema)) {
			if (aSchema.parents) {
				open.push(...aSchema.parents.filter(s => open.indexOf(s) === -1))
			}
			if (aSchema.implements) {
				open.push(...aSchema.implements.filter(s => open.indexOf(s) === -1))
			}
		} else if (isCodegenInterfaceSchema(aSchema)) {
			if (aSchema.parents) {
				open.push(...aSchema.parents.filter(s => open.indexOf(s) === -1))
			}
		} else if (isCodegenAllOfSchema(aSchema)) {
			open.push(...aSchema.composes.filter(s => open.indexOf(s) === -1))
		}
	}
	return result
}

/**
 * Post-process schemas to remove discriminator properties from objects. We don't remove the discriminator
 * properties earlier, as we need to keep them while we're reconciling all of the discriminators, and members,
 * as we try to find the discriminator property.
 * @param schema 
 * @returns 
 */
export function postProcessSchemaForDiscriminator(schema: CodegenSchema): void {
	if (!isCodegenDiscriminatorSchema(schema) || !schema.discriminator) {
		return
	}

	const discriminator = schema.discriminator

	/* Sort references so we generate in a consistent order */
	discriminator.references = discriminator.references.sort(compareDiscriminatorReferences)

	if (isCodegenObjectLikeSchema(schema) && schema.properties) {
		/* Check that the discriminator property isn't required for interface comformance */
		if (!interfaceForProperty(schema, discriminator.serializedName)) {
			removeProperty(schema, discriminator.serializedName)
		}
	}

	for (const reference of discriminator.references) {
		if (isCodegenObjectLikeSchema(reference.schema)) {
			/* Check that the discriminator property isn't required for interface comformance */
			if (!interfaceForProperty(reference.schema, discriminator.serializedName)) {
				removeProperty(reference.schema, discriminator.serializedName)
			}
		}
	}
}

function compareDiscriminatorReferences(a: CodegenDiscriminatorReference, b: CodegenDiscriminatorReference): number {
	return a.value.toLowerCase().localeCompare(b.value.toLowerCase())
}

/**
 * Find schemas in other documents (not the root, which are all discovered automatically) that should be members of the discriminator
 * of the given schema, so that we find all such schemas that may exist in referenced docs. Otherwise we don't end up discovering and
 * outputting those schemas if they're not directly referenced.
 * @param discriminatorApiSchema 
 * @param state 
 * @returns 
 */
export function discoverDiscriminatorReferencesInOtherDocuments(discriminatorApiSchema: OpenAPIX.SchemaObject, state: InternalCodegenState) {
	return discoverSchemasInOtherDocuments(createDiscriminatorMemberTestFunc(discriminatorApiSchema), state)
}

/**
 * Create a DiscoverRelatedSchemaTestFunc for finding schemas that reference the given discriminator schema.
 * @returns 
 */
function createDiscriminatorMemberTestFunc(discriminatorApiSchema: OpenAPIX.SchemaObject): DiscoverSchemasTestFunc {
	return function(anApiSchema, state) {
		if ((anApiSchema as OpenAPIX.SchemaObject).allOf) {
			const allOf = (anApiSchema as OpenAPIX.SchemaObject).allOf as Array<OpenAPIX.SchemaObject>
			for (const anAllOf of allOf) {
				if (anAllOf === discriminatorApiSchema) {
					return true
				}

				const resolved = resolveReference(anAllOf, state)
				if (resolved === discriminatorApiSchema) {
					return true
				}
			}
		}

		return false
	}
}
