import { CodegenMapSchema, CodegenSchemaPurpose, CodegenSchemaType, CodegenScope } from '@openapi-generator-plus/types'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { toCodegenSchemaUsage } from './index'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { extractCodegenSchemaCommon } from './utils'
import { extractNaming, ScopedModelInfo } from './naming'
import { toCodegenExternalDocs } from '../external-docs'

export function toCodegenMapSchema(schema: OpenAPIX.SchemaObject, naming: ScopedModelInfo | null, suggestedValueModelName: string, suggestedValueModelScope: CodegenScope | null, state: InternalCodegenState): CodegenMapSchema {
	const vendorExtensions = toCodegenVendorExtensions(schema)
	
	const keyNativeType = state.generator.toNativeType({
		type: 'string',
		schemaType: CodegenSchemaType.STRING,
		vendorExtensions,
	})
	const componentSchemaUsage = toCodegenSchemaUsage(schema.additionalProperties, state, {
		required: true,
		suggestedName: suggestedValueModelName,
		purpose: CodegenSchemaPurpose.MAP_VALUE,
		scope: suggestedValueModelScope,
	})

	const nativeType = state.generator.toNativeMapType({
		type: schema.type as string,
		format: schema.format,
		schemaType: CodegenSchemaType.MAP,
		keyNativeType,
		componentNativeType: componentSchemaUsage.nativeType,
		vendorExtensions,
	})

	const result: CodegenMapSchema = {
		...extractNaming(naming),
		
		type: 'object',
		format: schema.format || null,
		schemaType: CodegenSchemaType.MAP,
		component: componentSchemaUsage,
		nativeType,

		...extractCodegenSchemaCommon(schema, state),
		vendorExtensions,
		externalDocs: toCodegenExternalDocs(schema),

		maxProperties: schema.maxProperties || null,
		minProperties: schema.minProperties || null,
	}
	return result
}
