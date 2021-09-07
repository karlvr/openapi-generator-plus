import { CodegenNumericSchema, CodegenSchemaType } from '@openapi-generator-plus/types'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { toCodegenExternalDocs } from '../external-docs'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { extractNaming, ScopedModelInfo } from './naming'
import { toCodegenSchemaType } from './schema-type'
import { extractCodegenSchemaCommon } from './utils'

export function toCodegenNumericSchema(schema: OpenAPIX.SchemaObject, naming: ScopedModelInfo | null, state: InternalCodegenState): CodegenNumericSchema {
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
		schemaType,
		vendorExtensions,
	})

	const result: CodegenNumericSchema = {
		...extractNaming(naming),
		
		type: schema.type,
		format: schema.format || null,
		schemaType,
		nativeType,
		component: null,

		...extractCodegenSchemaCommon(schema, state),
		vendorExtensions,
		externalDocs: toCodegenExternalDocs(schema),

		maximum: schema.maximum || null,
		exclusiveMaximum: schema.exclusiveMaximum || null,
		minimum: schema.minimum || null,
		exclusiveMinimum: schema.exclusiveMinimum || null,
		multipleOf: schema.multipleOf || null,
	}
	return result
}
