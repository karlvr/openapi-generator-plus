import { CodegenBooleanSchema, CodegenSchemaType } from '@openapi-generator-plus/types'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { toCodegenExternalDocs } from '../external-docs'
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
		schemaType: CodegenSchemaType.BOOLEAN,
		vendorExtensions,
	})

	const result: CodegenBooleanSchema = {
		...extractNaming(naming),

		type: schema.type,
		format: format || null,
		schemaType: CodegenSchemaType.BOOLEAN,
		nativeType,
		component: null,

		...extractCodegenSchemaCommon(schema, state),
		vendorExtensions,
		externalDocs: toCodegenExternalDocs(schema),
	}
	return result
}
