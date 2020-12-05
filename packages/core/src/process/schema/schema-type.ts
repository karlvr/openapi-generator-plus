import { CodegenSchemaType } from '@openapi-generator-plus/types'
import { OpenAPIX } from '../../types/patches'

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
	} else if (type === 'string') {
		return CodegenSchemaType.STRING
	} else if (type === 'file') {
		return CodegenSchemaType.FILE
	} else {
		throw new Error(`Unsupported schema type: ${type}`)
	}
}

export function toCodegenSchemaTypeFromSchema(schema: OpenAPIX.SchemaObject): CodegenSchemaType {
	if (schema.allOf) {
		return CodegenSchemaType.OBJECT
	} else if (schema.anyOf) {
		return CodegenSchemaType.OBJECT
	} else if (schema.oneOf) {
		return CodegenSchemaType.OBJECT
	} else if (schema.enum) {
		return CodegenSchemaType.ENUM
	} else if (schema.additionalProperties) {
		return CodegenSchemaType.MAP
	} else if (typeof schema.type === 'string') {
		return toCodegenSchemaType(schema.type, schema.format)
	} else {
		throw new Error(`Invalid schema type "${schema.type}": ${JSON.stringify(schema)}`)
	}
}
