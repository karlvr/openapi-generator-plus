import { CodegenMapSchema, CodegenSchema, CodegenSchemaPurpose, CodegenSchemaType, CodegenSchemaUsage, CodegenScope } from '@openapi-generator-plus/types'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { SchemaOptions, toCodegenSchemaUsage } from './index'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { extractCodegenSchemaCommon, finaliseSchema } from './utils'
import { extractNaming, ScopedModelInfo } from './naming'
import { toCodegenExternalDocs } from '../external-docs'
import { debugStringify } from '@openapi-generator-plus/utils'

export interface MapSchemaOptions extends SchemaOptions {
	suggestedValueModelName: string
	suggestedValueModelScope: CodegenScope | null
}

export function toCodegenMapSchema(apiSchema: OpenAPIX.SchemaObject, options: MapSchemaOptions, state: InternalCodegenState): CodegenMapSchema {
	const { naming, purpose } = options
	const vendorExtensions = toCodegenVendorExtensions(apiSchema)
	
	const keyNativeType = state.generator.toNativeType({
		type: 'string',
		purpose,
		schemaType: CodegenSchemaType.STRING,
		vendorExtensions,
	})

	/* `additionalProperties: true` and `additionalProperties: {}` both permit values of any type (see
	   https://json-schema.org/understanding-json-schema/reference/object#additionalproperties), which the
	   empty schema expresses */
	let additionalProperties = apiSchema.additionalProperties
	if (additionalProperties === true) {
		additionalProperties = {}
	} else if (typeof additionalProperties !== 'object') {
		throw new Error(`Invalid additionalProperties value: ${debugStringify(additionalProperties)}`)
	}
	
	const componentSchemaUsage: CodegenSchemaUsage<CodegenSchema> = toCodegenSchemaUsage(additionalProperties, state, {
		required: true,
		suggestedName: options.suggestedValueModelName,
		purpose: CodegenSchemaPurpose.MAP_VALUE,
		suggestedScope: options.suggestedValueModelScope,
	})

	const nativeType = state.generator.toNativeMapType({
		type: apiSchema.type as string,
		format: apiSchema.format,
		purpose,
		schemaType: CodegenSchemaType.MAP,
		keyNativeType,
		componentNativeType: componentSchemaUsage.nativeType,
		vendorExtensions,
		encoding: options.encoding,
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
