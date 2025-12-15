import { CodegenBooleanSchema, CodegenSchemaPurpose, CodegenSchemaType } from '@openapi-generator-plus/types'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { toCodegenExternalDocs } from '../external-docs'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { extractNaming, ScopedModelInfo } from './naming'
import { extractCodegenSchemaCommon, finaliseSchema } from './utils'
import { SchemaOptions } from '.'

export function toCodegenBooleanSchema(apiSchema: OpenAPIX.SchemaObject, options: SchemaOptions, state: InternalCodegenState): CodegenBooleanSchema {
	const { naming, purpose } = options

	if (apiSchema.type !== 'boolean') {
		throw new Error('Not a boolean schema')
	}

	const format: string | undefined = apiSchema.format
	const vendorExtensions = toCodegenVendorExtensions(apiSchema)

	const nativeType = state.generator.toNativeType({
		type: apiSchema.type,
		format,
		purpose,
		schemaType: CodegenSchemaType.BOOLEAN,
		vendorExtensions,
	})

	const result: CodegenBooleanSchema = {
		...extractNaming(naming),

		type: apiSchema.type,
		format: format || null,
		purpose,
		schemaType: CodegenSchemaType.BOOLEAN,
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
