import { CodegenNumericSchema, CodegenSchemaType, CodegenSchemaUsage } from '@openapi-generator-plus/types'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { toCodegenExternalDocs } from '../external-docs'
import { convertToBoolean, convertToNumber } from '../utils'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { extractNaming, ScopedModelInfo } from './naming'
import { toCodegenSchemaType } from './schema-type'
import { extractCodegenSchemaCommon, finaliseSchema } from './utils'
import { CreateSchemaUsageOptions, createSchemaUsage } from './usage'

export function toCodegenNumericSchema(apiSchema: OpenAPIX.SchemaObject, naming: ScopedModelInfo | null, state: InternalCodegenState): CodegenNumericSchema {
	if (apiSchema.type !== 'number' && apiSchema.type !== 'integer') {
		throw new Error('Not a numeric schema')
	}

	const schemaType = toCodegenSchemaType(apiSchema.type, apiSchema.format)
	if (schemaType !== CodegenSchemaType.NUMBER && schemaType !== CodegenSchemaType.INTEGER) {
		throw new Error(`Unsupported numeric schema type: ${schemaType}`)
	}
	
	const vendorExtensions = toCodegenVendorExtensions(apiSchema)

	const nativeType = state.generator.toNativeType({
		type: apiSchema.type,
		format: apiSchema.format,
		schemaType,
		vendorExtensions,
	})

	const result: CodegenNumericSchema = {
		...extractNaming(naming),
		
		type: apiSchema.type,
		format: apiSchema.format || null,
		schemaType,
		nativeType,
		component: null,

		...extractCodegenSchemaCommon(apiSchema, state),
		vendorExtensions,
		externalDocs: toCodegenExternalDocs(apiSchema),

		/* Support OpenAPI v3.0 and v3.1 here, see https://www.openapis.org/blog/2021/02/16/migrating-from-openapi-3-0-to-3-1-0 */
		maximum: typeof apiSchema.exclusiveMaximum === 'number' ? convertToNumber(apiSchema.exclusiveMaximum) : convertToNumber(apiSchema.maximum),
		exclusiveMaximum: typeof apiSchema.exclusiveMaximum === 'number' ? true : convertToBoolean(apiSchema.exclusiveMaximum, null),
		minimum: typeof apiSchema.exclusiveMinimum === 'number' ? convertToNumber(apiSchema.exclusiveMinimum) : convertToNumber(apiSchema.minimum),
		exclusiveMinimum: typeof apiSchema.exclusiveMinimum === 'number' ? true : convertToBoolean(apiSchema.exclusiveMinimum, null),
		multipleOf: convertToNumber(apiSchema.multipleOf),
	}

	finaliseSchema(result, naming, state)
	return result
}

/**
 * Create a new schema usage of a numeric type.
 * @param state 
 */
export function createNumericSchemaUsage(format: string | undefined, options: CreateSchemaUsageOptions, state: InternalCodegenState): CodegenSchemaUsage<CodegenNumericSchema> {
	const schema = toCodegenNumericSchema({
		type: 'number',
		format,
	}, null, state)
	return createSchemaUsage(schema, options, state)
}
