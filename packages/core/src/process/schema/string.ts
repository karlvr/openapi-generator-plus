import { CodegenSchemaType, CodegenSchemaUsage, CodegenStringSchema } from '@openapi-generator-plus/types'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { toCodegenExternalDocs } from '../external-docs'
import { convertToNumber, extractCodegenSchemaInfo } from '../utils'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { extractNaming, ScopedModelInfo } from './naming'
import { toCodegenSchemaType } from './schema-type'
import { extractCodegenSchemaCommon } from './utils'

export function toCodegenStringSchema(apiSchema: OpenAPIX.SchemaObject, naming: ScopedModelInfo | null, state: InternalCodegenState): CodegenStringSchema {
	if (apiSchema.type !== 'string') {
		throw new Error('Not a string schema')
	}

	const format: string | undefined = apiSchema.format
	const schemaType = toCodegenSchemaType(apiSchema.type, format)
	if (schemaType !== CodegenSchemaType.STRING && schemaType !== CodegenSchemaType.DATE && schemaType !== CodegenSchemaType.DATETIME && schemaType !== CodegenSchemaType.TIME) {
		throw new Error(`Unsupported string schema type: ${schemaType}`)
	}

	const vendorExtensions = toCodegenVendorExtensions(apiSchema)

	const nativeType = state.generator.toNativeType({
		type: apiSchema.type,
		format,
		schemaType: CodegenSchemaType.STRING,
		vendorExtensions,
	})

	const result: CodegenStringSchema = {
		...extractNaming(naming),
		
		type: apiSchema.type,
		format: format || null,
		schemaType,
		nativeType,
		component: null,

		...extractCodegenSchemaCommon(apiSchema, state),
		vendorExtensions,
		externalDocs: toCodegenExternalDocs(apiSchema),

		maxLength: convertToNumber(apiSchema.maxLength),
		minLength: convertToNumber(apiSchema.minLength),
		pattern: apiSchema.pattern || null,
	}
	return result
}

/**
 * Create a new schema usage of a string type.
 * @param state 
 */
export function createStringSchemaUsage(state: InternalCodegenState): CodegenSchemaUsage<CodegenStringSchema>
export function createStringSchemaUsage(format: string, state: InternalCodegenState): CodegenSchemaUsage<CodegenStringSchema>
export function createStringSchemaUsage(formatOrState: string | InternalCodegenState, possiblyState?: InternalCodegenState): CodegenSchemaUsage<CodegenStringSchema> {
	const format = typeof formatOrState === 'string' ? formatOrState : undefined
	const state: InternalCodegenState = typeof formatOrState === 'string' ? possiblyState! : formatOrState

	const schema = toCodegenStringSchema({
		type: 'string',
		format,
	}, null, state)
	return {
		schema,
		...extractCodegenSchemaInfo(schema),
		required: false,
		examples: null,
		defaultValue: null,
	}
}
