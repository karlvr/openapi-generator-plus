import { CodegenMapSchema, CodegenMapTypePurpose, CodegenSchemaPurpose, CodegenSchemaType, CodegenScope } from '@openapi-generator-plus/types'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { toCodegenSchemaUsage } from './index'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { extractCodegenSchemaCommon } from './utils'
import { extractNaming, ScopedModelInfo } from './naming'

export function toCodegenMapSchema(schema: OpenAPIX.SchemaObject, naming: ScopedModelInfo | null, suggestedValueModelName: string, suggestedValueModelScope: CodegenScope | null, purpose: CodegenMapTypePurpose, state: InternalCodegenState): CodegenMapSchema {
	const vendorExtensions = toCodegenVendorExtensions(schema)
	
	const keyNativeType = state.generator.toNativeType({
		type: 'string',
		required: true,
		vendorExtensions,
	})
	const componentSchemaUsage = toCodegenSchemaUsage(schema.additionalProperties, true, suggestedValueModelName, CodegenSchemaPurpose.MAP_VALUE, suggestedValueModelScope, state)

	const nativeType = state.generator.toNativeMapType({
		keyNativeType,
		componentNativeType: componentSchemaUsage.nativeType,
		vendorExtensions,
		purpose,
	})

	const result: CodegenMapSchema = {
		...extractNaming(naming),
		
		type: 'object',
		format: schema.format || null,
		schemaType: CodegenSchemaType.MAP,
		componentSchema: componentSchemaUsage.schema,
		nativeType,

		...extractCodegenSchemaCommon(schema, state),
		vendorExtensions,

		maxProperties: schema.maxProperties || null,
		minProperties: schema.minProperties || null,
	}
	return result
}
