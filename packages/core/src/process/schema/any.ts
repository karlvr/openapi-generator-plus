import { CodegenAnySchema, CodegenSchemaPurpose, CodegenSchemaType } from '@openapi-generator-plus/types'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { toCodegenExternalDocs } from '../external-docs'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { extractNaming, ScopedModelInfo } from './naming'
import { extractCodegenSchemaCommon, finaliseSchema } from './utils'
import { SchemaOptions } from '.'

export function toCodegenAnySchema(apiSchema: OpenAPIX.SchemaObject, options: SchemaOptions, state: InternalCodegenState): CodegenAnySchema {
	const { naming, purpose } = options

	if (Object.keys(apiSchema).length !== 0) {
		throw new Error('Not an any schema')
	}

	const vendorExtensions = toCodegenVendorExtensions(apiSchema)
	const nativeType = state.generator.toNativeType({
		type: 'any',
		purpose,
		schemaType: CodegenSchemaType.ANY,
		vendorExtensions,
	})

	const result: CodegenAnySchema = {
		...extractNaming(naming),

		type: 'any',
		format: null,
		purpose,
		schemaType: CodegenSchemaType.ANY,
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
