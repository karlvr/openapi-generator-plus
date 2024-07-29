import { CodegenSchemaType } from '@openapi-generator-plus/types'
import { debugStringify } from '@openapi-generator-plus/utils'
import { OpenAPIX } from '../../types/patches'

/**
 * Converts the OpenAPI specification's `type` and `format` values into a `CodegenSchemaType`, which is what the generator uses
 * to determine the type handling.
 */
export function toCodegenSchemaType(type: string, format: string | undefined): CodegenSchemaType {
	if (type === 'object') {
		return CodegenSchemaType.OBJECT
	} else if (type === 'array') {
		return CodegenSchemaType.ARRAY
	} else if (type === 'boolean') {
		return CodegenSchemaType.BOOLEAN
	} else if (type === 'number') {
		return CodegenSchemaType.NUMBER
	} else if (type === 'integer') {
		return CodegenSchemaType.INTEGER
	} else if (type === 'string' && format === 'date-time') {
		return CodegenSchemaType.DATETIME
	} else if (type === 'string' && format === 'date') {
		return CodegenSchemaType.DATE
	} else if (type === 'string' && format === 'time') {
		return CodegenSchemaType.TIME
	} else if (type === 'string' && format === 'binary') {
		return CodegenSchemaType.BINARY
	} else if (type === 'string') {
		return CodegenSchemaType.STRING
	} else if (type === 'file') {
		return CodegenSchemaType.BINARY
	} else if (type === 'null') {
		return CodegenSchemaType.NULL
	} else {
		throw new Error(`Unsupported schema type: ${type}`)
	}
}

export function toCodegenSchemaTypeFromApiSchema(apiSchema: OpenAPIX.SchemaObject): CodegenSchemaType {
	if (apiSchema.allOf) {
		return CodegenSchemaType.ALLOF
	} else if (apiSchema.anyOf) {
		return CodegenSchemaType.ANYOF
	} else if (apiSchema.oneOf) {
		return CodegenSchemaType.ONEOF
	} else if (apiSchema.enum && apiSchema.type !== 'boolean') { /* Not sure which types should support enums, but boolean shouldn't - Jackson doesn't support them in its implementation */
		return CodegenSchemaType.ENUM
	} else if (apiSchema.type === 'object' && apiSchema.additionalProperties && (!apiSchema.properties || Object.keys(apiSchema.properties).length === 0)) {
		return CodegenSchemaType.MAP
	} else if (typeof apiSchema.type === 'string') {
		return toCodegenSchemaType(apiSchema.type, apiSchema.format)
	} else if (Object.keys(apiSchema).length == 0) {
		/* An empty object means the value can be any valid JSON (see https://json-schema.org/understanding-json-schema/basics#hello-world!) */
		return CodegenSchemaType.ANY
	} else if (apiSchema.type === undefined) {
		throw new Error(`Missing schema type in schema: ${debugStringify(apiSchema)}`)
	} else if (apiSchema.type === null) {
		throw new Error(`Invalid null schema type (the word "null" should probably be quoted) in schema: ${debugStringify(apiSchema)}`)
	} else {
		throw new Error(`Invalid schema type "${apiSchema.type}" in schema: ${debugStringify(apiSchema)}`)
	}
}
