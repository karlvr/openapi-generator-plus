import { CodegenArraySchema, CodegenArrayTypePurpose, CodegenSchemaPurpose, CodegenSchemaType, CodegenScope } from '@openapi-generator-plus/types'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { toCodegenSchemaUsage } from './index'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { extractCodegenSchemaCommon } from './utils'
import { extractNaming, ScopedModelInfo } from './naming'

export function toCodegenArraySchema(schema: OpenAPIX.SchemaObject, naming: ScopedModelInfo | null, suggestedItemModelName: string, suggestedItemModelScope: CodegenScope | null, purpose: CodegenArrayTypePurpose, state: InternalCodegenState): CodegenArraySchema {
	if (schema.type !== 'array') {
		throw new Error('Not an array schema')
	}

	if (!schema.items) {
		throw new Error('items missing for schema type "array"')
	}

	const vendorExtensions = toCodegenVendorExtensions(schema)

	/* Component properties are implicitly required as we don't expect to have `null` entries in the array. */
	const componentSchemaUsage = toCodegenSchemaUsage(schema.items, state, {
		required: true,
		suggestedName: suggestedItemModelName,
		purpose: CodegenSchemaPurpose.ARRAY_ITEM,
		scope: suggestedItemModelScope,
	})
	const nativeType = state.generator.toNativeArrayType({
		type: schema.type,
		format: schema.format,
		componentNativeType: componentSchemaUsage.nativeType,
		uniqueItems: schema.uniqueItems,
		purpose,
		vendorExtensions,
	})

	const result: CodegenArraySchema = {
		...extractNaming(naming),
		
		type: 'array',
		format: schema.format || null,
		schemaType: CodegenSchemaType.ARRAY,
		componentSchema: componentSchemaUsage.schema,
		nativeType,

		...extractCodegenSchemaCommon(schema, state),

		vendorExtensions,

		maxItems: schema.maxItems || null,
		minItems: schema.minItems || null,
		uniqueItems: schema.uniqueItems || null,
	}
	return result
}
