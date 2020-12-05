import { CodegenNumericSchema, CodegenSchemaType } from '@openapi-generator-plus/types'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { toCodegenSchemaType } from './schema-type'
import { extractCodegenSchemaCommon } from './utils'

export function toCodegenNumericSchema(schema: OpenAPIX.SchemaObject, state: InternalCodegenState): CodegenNumericSchema {
	if (schema.type !== 'number' && schema.type !== 'integer') {
		throw new Error('Not a numeric schema')
	}

	const schemaType = toCodegenSchemaType(schema.type, schema.format)
	if (schemaType !== CodegenSchemaType.NUMBER && schemaType !== CodegenSchemaType.INTEGER) {
		throw new Error(`Unsupported numeric schema type: ${schemaType}`)
	}
	
	const vendorExtensions = toCodegenVendorExtensions(schema)

	const nativeType = state.generator.toNativeType({
		type: schema.type,
		format: schema.format,
		required: true,
		vendorExtensions,
	})

	const result: CodegenNumericSchema = {
		type: schema.type,
		format: schema.format || null,
		schemaType,
		nativeType,
		componentSchema: null,

		...extractCodegenSchemaCommon(schema, state),
		vendorExtensions,

		maximum: schema.maximum || null,
		exclusiveMaximum: schema.exclusiveMaximum || null,
		minimum: schema.minimum || null,
		exclusiveMinimum: schema.exclusiveMinimum || null,
		multipleOf: schema.multipleOf || null,
	}
	return result
}
