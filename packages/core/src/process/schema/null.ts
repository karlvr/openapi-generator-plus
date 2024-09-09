import { CodegenNullSchema, CodegenSchemaPurpose, CodegenSchemaType } from '@openapi-generator-plus/types'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { toCodegenExternalDocs } from '../external-docs'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { extractNaming, ScopedModelInfo } from './naming'
import { extractCodegenSchemaCommon, finaliseSchema } from './utils'

export function toCodegenNullSchema(apiSchema: OpenAPIX.SchemaObject, naming: ScopedModelInfo | null, purpose: CodegenSchemaPurpose, state: InternalCodegenState): CodegenNullSchema {
	if (apiSchema.type !== 'null') {
		throw new Error('Not a null schema')
	}

	const vendorExtensions = toCodegenVendorExtensions(apiSchema)
	const nativeType = state.generator.toNativeType({
		type: 'null',
		purpose,
		schemaType: CodegenSchemaType.NULL,
		vendorExtensions,
	})

	const result: CodegenNullSchema = {
		...extractNaming(naming),

		type: 'null',
		format: null,
		purpose,
		schemaType: CodegenSchemaType.NULL,
		contentMediaType: null,
		nativeType,
		component: null,

		...extractCodegenSchemaCommon(apiSchema, state),
		vendorExtensions,
		externalDocs: toCodegenExternalDocs(apiSchema),
	}

	finaliseSchema(result, naming, state)
	return result
}
