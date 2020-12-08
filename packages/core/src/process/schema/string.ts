import { CodegenSchema, CodegenSchemaType, CodegenScope, CodegenStringSchema } from '@openapi-generator-plus/types'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { nameFromRef } from '../utils'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { extractNaming, ScopedModelInfo } from './naming'
import { toCodegenSchemaType } from './schema-type'
import { extractCodegenSchemaCommon } from './utils'

export function toCodegenStringSchema(schema: OpenAPIX.SchemaObject, naming: ScopedModelInfo | null, state: InternalCodegenState): CodegenStringSchema {
	if (schema.type !== 'string') {
		throw new Error('Not a string schema')
	}

	const format: string | undefined = schema.format
	const schemaType = toCodegenSchemaType(schema.type, format)
	if (schemaType !== CodegenSchemaType.STRING && schemaType !== CodegenSchemaType.DATE && schemaType !== CodegenSchemaType.DATETIME && schemaType !== CodegenSchemaType.TIME) {
		throw new Error(`Unsupported string schema type: ${schemaType}`)
	}

	const vendorExtensions = toCodegenVendorExtensions(schema)

	const nativeType = state.generator.toNativeType({
		type: schema.type,
		format,
		required: true,
		vendorExtensions,
	})

	const result: CodegenStringSchema = {
		...extractNaming(naming),
		
		type: schema.type,
		format: format || null,
		schemaType,
		nativeType,
		componentSchema: null,

		...extractCodegenSchemaCommon(schema, state),
		vendorExtensions,

		maxLength: schema.maxLength || null,
		minLength: schema.minLength || null,
		pattern: schema.pattern || null,
	}
	return result
}
