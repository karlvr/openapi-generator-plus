import { CodegenSchemaType, CodegenSchemaUsage, CodegenStringSchema } from '@openapi-generator-plus/types'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { toCodegenExternalDocs } from '../external-docs'
import { convertToNumber, extractCodegenSchemaInfo } from '../utils'
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
		schemaType: CodegenSchemaType.STRING,
		vendorExtensions,
	})

	const result: CodegenStringSchema = {
		...extractNaming(naming),
		
		type: schema.type,
		format: format || null,
		schemaType,
		nativeType,
		component: null,

		...extractCodegenSchemaCommon(schema, state),
		vendorExtensions,
		externalDocs: toCodegenExternalDocs(schema),

		maxLength: convertToNumber(schema.maxLength),
		minLength: convertToNumber(schema.minLength),
		pattern: schema.pattern || null,
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
