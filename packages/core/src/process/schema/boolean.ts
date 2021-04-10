import { CodegenBooleanSchema, CodegenSchemaType } from '@openapi-generator-plus/types'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { extractNaming, ScopedModelInfo } from './naming'
import { extractCodegenSchemaCommon } from './utils'

export function toCodegenBooleanSchema(schema: OpenAPIX.SchemaObject, naming: ScopedModelInfo | null, state: InternalCodegenState): CodegenBooleanSchema {
	if (schema.type !== 'boolean') {
		throw new Error('Not a boolean schema')
	}

	const format: string | undefined = schema.format
	const vendorExtensions = toCodegenVendorExtensions(schema)

	const nativeType = state.generator.toNativeType({
		type: schema.type,
		format,
		required: true,
		nullable: schema.nullable || false,
		vendorExtensions,
	})

	const result: CodegenBooleanSchema = {
		...extractNaming(naming),

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
