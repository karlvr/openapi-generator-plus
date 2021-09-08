import { CodegenBooleanSchema, CodegenSchemaType } from '@openapi-generator-plus/types'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { toCodegenExternalDocs } from '../external-docs'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { extractNaming, ScopedModelInfo } from './naming'
import { extractCodegenSchemaCommon } from './utils'

export function toCodegenBooleanSchema(apiSchema: OpenAPIX.SchemaObject, naming: ScopedModelInfo | null, state: InternalCodegenState): CodegenBooleanSchema {
	if (apiSchema.type !== 'boolean') {
		throw new Error('Not a boolean schema')
	}

	const format: string | undefined = apiSchema.format
	const vendorExtensions = toCodegenVendorExtensions(apiSchema)

	const nativeType = state.generator.toNativeType({
		type: apiSchema.type,
		format,
		schemaType: CodegenSchemaType.BOOLEAN,
		vendorExtensions,
	})

	const result: CodegenBooleanSchema = {
		...extractNaming(naming),

		type: apiSchema.type,
		format: format || null,
		schemaType: CodegenSchemaType.BOOLEAN,
		nativeType,
		component: null,

		...extractCodegenSchemaCommon(apiSchema, state),
		vendorExtensions,
		externalDocs: toCodegenExternalDocs(apiSchema),
	}
	return result
}
