import { CodegenDiscriminator, CodegenDiscriminatorMappings, CodegenDiscriminatorSchema, CodegenObjectSchema, CodegenSchemaPurpose, CodegenTypeInfo, isCodegenObjectSchema } from '@openapi-generator-plus/types'
import { OpenAPIV3 } from 'openapi-types'
import { toCodegenSchemaUsage } from '.'
import { idx } from '../..'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { extractCodegenTypeInfo, resolveReference } from '../utils'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { removeProperty } from './utils'

export function toCodegenSchemaDiscriminator(schema: OpenAPIX.SchemaObject, target: CodegenDiscriminatorSchema, state: InternalCodegenState): CodegenDiscriminator | null {
	if (!schema.discriminator) {
		return null
	}

	/* Object has a discriminator so all submodels will need to add themselves */
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
	}

	const result: CodegenDiscriminator = {
		name: schemaDiscriminator.propertyName,
		mappings: toCodegenDiscriminatorMappings(schemaDiscriminator),
		references: [],
		...discriminatorType!,
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
