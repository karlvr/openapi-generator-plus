import { CodegenDiscriminator, CodegenDiscriminatorMappings, CodegenDiscriminatorSchema, CodegenNamedSchema, CodegenObjectSchema, CodegenSchema, CodegenSchemaPurpose, CodegenTypeInfo, isCodegenAnyOfSchema, isCodegenInterfaceSchema, isCodegenObjectSchema, isCodegenOneOfSchema } from '@openapi-generator-plus/types'
import { OpenAPIV3 } from 'openapi-types'
import { toCodegenSchemaUsage } from '.'
import * as idx from '@openapi-generator-plus/indexed-type'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { equalCodegenTypeInfo, extractCodegenTypeInfo, resolveReference, typeInfoToString } from '../utils'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { removeProperty } from './utils'

/**
 * Create a CodegenDiscriminator for the given schema, to be put into the target
 * @param schema the schema containing the discriminator
 * @param target the CodegenDiscriminatorSchema where the discriminator will go 
 * @param state 
 * @returns 
 */
export function toCodegenSchemaDiscriminator(schema: OpenAPIX.SchemaObject, target: CodegenDiscriminatorSchema, state: InternalCodegenState): CodegenDiscriminator | null {
	if (!schema.discriminator) {
		return null
	}

	let schemaDiscriminator = schema.discriminator as string | OpenAPIV3.DiscriminatorObject
	if (typeof schemaDiscriminator === 'string') {
		/* OpenAPIv2 support */
		const vendorExtensions = toCodegenVendorExtensions(schema)

		schemaDiscriminator = {
			propertyName: schemaDiscriminator,
			/* Note that we support a vendor extension here to allow mappings in OpenAPI v2 specs */
			mapping: vendorExtensions && vendorExtensions['x-discriminator-mapping'],
		}
	}

	let discriminatorType: CodegenTypeInfo | undefined = undefined
	if (isCodegenObjectSchema(target)) {
		const discriminatorProperty = removeProperty(target, schemaDiscriminator.propertyName)
		if (!discriminatorProperty) {
			throw new Error(`Discriminator property "${schemaDiscriminator.propertyName}" missing from "${target.name}"`)
		}

		discriminatorType = extractCodegenTypeInfo(discriminatorProperty)
	} else if (isCodegenAnyOfSchema(target) || isCodegenOneOfSchema(target)) {
		/* For an anyOf or oneOf schemas we have to look in their composes to find the property */
		discriminatorType = findCommonDiscriminatorPropertyType(schemaDiscriminator.propertyName, target.composes, target)
	} else if (isCodegenInterfaceSchema(target)) {
		/* For an interface schema, we need to look in its implementors */
		discriminatorType = findCommonDiscriminatorPropertyType(schemaDiscriminator.propertyName, target.implementors || [], target)
	} else {
		throw new Error(`Unsupported schema type for discriminator: ${target.schemaType}`)
	}

	const result: CodegenDiscriminator = {
		name: schemaDiscriminator.propertyName,
		mappings: toCodegenDiscriminatorMappings(schemaDiscriminator),
		references: [],
		...discriminatorType,
	}

	/* Make sure we load any models referenced by the discriminator, as they may not be
	in our components/schemas that we load automatically, such as when they're in external
	documents.
	*/
	if (result.mappings) {
		for (const mappingRef of Object.keys(result.mappings)) {
			toCodegenSchemaUsage({ $ref: mappingRef }, state, {
				required: false,
				suggestedName: 'discriminatorMapping',
				purpose: CodegenSchemaPurpose.MODEL,
				scope: null,
			})
		}
	}

	return result
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

/**
 * Find the common discriminator property type for a named discimrinator property across a collection of schemas.
 * @param propertyName the name of the property
 * @param schemas the schemas to look for the property in
 * @param container the container of the discriminator property
 * @returns 
 */
function findCommonDiscriminatorPropertyType(propertyName: string, schemas: CodegenSchema[], container: CodegenNamedSchema): CodegenTypeInfo {
	let result: CodegenTypeInfo | undefined = undefined
	for (const schema of schemas) {
		if (isCodegenObjectSchema(schema)) {
			if (schema.properties) {
				const property = idx.get(schema.properties, propertyName)
				if (property) {
					const propertyType = extractCodegenTypeInfo(property)
					if (result === undefined) {
						result = propertyType
					} else if (!equalCodegenTypeInfo(result, propertyType)) {
						throw new Error(`Found mismatching type for discriminator property "${propertyName}" for "${container.name}" in "${schema.name}": ${typeInfoToString(propertyType)} vs ${typeInfoToString(result)}`)
					}
				} else {
					throw new Error(`Discriminator property "${propertyName}" for "${container.name}" missing in "${schema.name}"`)
				}
			}
		} else {
			throw new Error(`Found unexpected schema type (${schema.schemaType}) when looking for discriminator property "${propertyName}" for "${container.name}"`)
		}
	}
	if (!result) {
		throw new Error(`Discriminator property "${propertyName}" missing from all schemas for "${container.name}"`)
	}
	return result
}

/**
 * Find the appropriate discriminator value to use for the given model
 * @param discriminator the discriminator
 * @param model the model to find the value for
 * @returns 
 */
export function findDiscriminatorValue(discriminator: CodegenDiscriminator, model: CodegenObjectSchema, state: InternalCodegenState): string {
	const name = model.serializedName || model.name
	if (!discriminator.mappings) {
		return name
	}
	
	for (const [$ref, value] of idx.iterable(discriminator.mappings)) {
		const resolvedSchema = resolveReference({
			$ref,
		}, state)
		const found = state.knownSchemas.get(resolvedSchema)
		if (found === model) {
			return value
		}
	}

	return name
}
