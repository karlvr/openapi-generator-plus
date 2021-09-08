import { CodegenNumericSchema, CodegenSchemaType } from '@openapi-generator-plus/types'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { toCodegenExternalDocs } from '../external-docs'
import { convertToBoolean, convertToNumber } from '../utils'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { extractNaming, ScopedModelInfo } from './naming'
import { toCodegenSchemaType } from './schema-type'
import { extractCodegenSchemaCommon } from './utils'

export function toCodegenNumericSchema(apiSchema: OpenAPIX.SchemaObject, naming: ScopedModelInfo | null, state: InternalCodegenState): CodegenNumericSchema {
	if (apiSchema.type !== 'number' && apiSchema.type !== 'integer') {
		throw new Error('Not a numeric schema')
	}

	const schemaType = toCodegenSchemaType(apiSchema.type, apiSchema.format)
	if (schemaType !== CodegenSchemaType.NUMBER && schemaType !== CodegenSchemaType.INTEGER) {
		throw new Error(`Unsupported numeric schema type: ${schemaType}`)
	}
	
	const vendorExtensions = toCodegenVendorExtensions(apiSchema)

	const nativeType = state.generator.toNativeType({
		type: apiSchema.type,
		format: apiSchema.format,
		schemaType,
		vendorExtensions,
	})

	const result: CodegenNumericSchema = {
		...extractNaming(naming),
		
		type: apiSchema.type,
		format: apiSchema.format || null,
		schemaType,
		nativeType,
		component: null,

		...extractCodegenSchemaCommon(apiSchema, state),
		vendorExtensions,
		externalDocs: toCodegenExternalDocs(apiSchema),

		maximum: convertToNumber(apiSchema.maximum),
		exclusiveMaximum: convertToBoolean(apiSchema.exclusiveMaximum, null),
		minimum: convertToNumber(apiSchema.minimum),
		exclusiveMinimum: convertToBoolean(apiSchema.exclusiveMinimum, null),
		multipleOf: convertToNumber(apiSchema.multipleOf),
	}
	return result
}
