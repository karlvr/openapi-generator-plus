import { CodegenArraySchema, CodegenSchemaPurpose, CodegenSchemaType, CodegenScope } from '@openapi-generator-plus/types'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { toCodegenSchemaUsage } from './index'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { extractCodegenSchemaCommon } from './utils'
import { extractNaming, ScopedModelInfo } from './naming'
import { toCodegenExternalDocs } from '../external-docs'
import { convertToBoolean, convertToNumber } from '../utils'

export function toCodegenArraySchema(apiSchema: OpenAPIX.SchemaObject, naming: ScopedModelInfo | null, suggestedItemModelName: string, suggestedItemModelScope: CodegenScope | null, state: InternalCodegenState): CodegenArraySchema {
	if (apiSchema.type !== 'array') {
		throw new Error('Not an array schema')
	}

	if (!apiSchema.items) {
		throw new Error('items missing for schema type "array"')
	}

	const vendorExtensions = toCodegenVendorExtensions(apiSchema)

	/* Component properties are implicitly required as we don't expect to have `null` entries in the array. */
	const componentSchemaUsage = toCodegenSchemaUsage(apiSchema.items, state, {
		required: true,
		suggestedName: suggestedItemModelName,
		purpose: CodegenSchemaPurpose.ARRAY_ITEM,
		scope: suggestedItemModelScope,
	})
	const nativeType = state.generator.toNativeArrayType({
		type: apiSchema.type,
		format: apiSchema.format,
		schemaType: CodegenSchemaType.ARRAY,
		componentNativeType: componentSchemaUsage.nativeType,
		uniqueItems: apiSchema.uniqueItems,
		vendorExtensions,
	})

	const result: CodegenArraySchema = {
		...extractNaming(naming),
		
		type: 'array',
		format: apiSchema.format || null,
		schemaType: CodegenSchemaType.ARRAY,
		component: componentSchemaUsage,
		nativeType,

		...extractCodegenSchemaCommon(apiSchema, state),

		vendorExtensions,
		externalDocs: toCodegenExternalDocs(apiSchema),

		maxItems: convertToNumber(apiSchema.maxItems),
		minItems: convertToNumber(apiSchema.minItems),
		uniqueItems: convertToBoolean(apiSchema.uniqueItems, null),
	}
	return result
}
