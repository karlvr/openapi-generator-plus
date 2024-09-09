import { CodegenMapSchema, CodegenSchema, CodegenSchemaPurpose, CodegenSchemaType, CodegenSchemaUsage, CodegenScope } from '@openapi-generator-plus/types'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { toCodegenSchemaUsage } from './index'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { extractCodegenSchemaCommon, finaliseSchema } from './utils'
import { extractNaming, ScopedModelInfo } from './naming'
import { toCodegenExternalDocs } from '../external-docs'
import { debugStringify } from '@openapi-generator-plus/utils'

export function toCodegenMapSchema(apiSchema: OpenAPIX.SchemaObject, naming: ScopedModelInfo | null, suggestedValueModelName: string, suggestedValueModelScope: CodegenScope | null, purpose: CodegenSchemaPurpose, state: InternalCodegenState): CodegenMapSchema {
	const vendorExtensions = toCodegenVendorExtensions(apiSchema)
	
	const keyNativeType = state.generator.toNativeType({
		type: 'string',
		purpose,
		schemaType: CodegenSchemaType.STRING,
		vendorExtensions,
	})

	let additionalProperties = apiSchema.additionalProperties
	if (additionalProperties === true) {
		additionalProperties = { type: 'string' }
	} else if (typeof additionalProperties === 'object') {
		if (Object.keys(additionalProperties).length === 0) {
			/* Handle an empty object */
			additionalProperties = { type: 'string' }
		}
	} else {
		throw new Error(`Invalid additionalProperties value: ${debugStringify(additionalProperties)}`)
	}
	
	const componentSchemaUsage: CodegenSchemaUsage<CodegenSchema> = toCodegenSchemaUsage(additionalProperties, state, {
		required: true,
		suggestedName: suggestedValueModelName,
		purpose: CodegenSchemaPurpose.MAP_VALUE,
		suggestedScope: suggestedValueModelScope,
	})

	const nativeType = state.generator.toNativeMapType({
		type: apiSchema.type as string,
		format: apiSchema.format,
		schemaType: CodegenSchemaType.MAP,
		keyNativeType,
		componentNativeType: componentSchemaUsage.nativeType,
		vendorExtensions,
	})

	const result: CodegenMapSchema = {
		...extractNaming(naming),
		
		type: 'object',
		format: apiSchema.format || null,
		purpose,
		schemaType: CodegenSchemaType.MAP,
		contentMediaType: null,
		component: componentSchemaUsage,
		nativeType,

		...extractCodegenSchemaCommon(apiSchema, state),
		vendorExtensions,
		externalDocs: toCodegenExternalDocs(apiSchema),

		maxProperties: apiSchema.maxProperties || null,
		minProperties: apiSchema.minProperties || null,
	}
	
	finaliseSchema(result, naming, state)
	return result
}
