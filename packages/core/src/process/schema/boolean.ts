import { CodegenBooleanSchema, CodegenSchemaType } from '@openapi-generator-plus/types'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { extractCodegenSchemaCommon } from './utils'

export function toCodegenBooleanSchema(schema: OpenAPIX.SchemaObject, state: InternalCodegenState): CodegenBooleanSchema {
	if (schema.type !== 'boolean') {
		throw new Error('Not a boolean schema')
	}

	const format: string | undefined = schema.format
	const vendorExtensions = toCodegenVendorExtensions(schema)

	const nativeType = state.generator.toNativeType({
		type: schema.type,
		format,
		required: true,
		vendorExtensions,
	})

	const result: CodegenBooleanSchema = {
		type: schema.type,
		format: format || null,
		schemaType: CodegenSchemaType.BOOLEAN,
		nativeType,
		componentSchema: null,

		...extractCodegenSchemaCommon(schema, state),
		vendorExtensions,
	}
	return result
}
