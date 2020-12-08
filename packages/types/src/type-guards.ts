import { CodegenArraySchema, CodegenBooleanSchema, CodegenEnumSchema, CodegenMapSchema, CodegenNamedSchema, CodegenNumericSchema, CodegenObjectSchema, CodegenSchema, CodegenSchemaType, CodegenScope, CodegenStringSchema } from './types'

export function isCodegenNumericSchema(schema: CodegenSchema): schema is CodegenNumericSchema {
	return schema.schemaType === CodegenSchemaType.NUMBER || schema.schemaType == CodegenSchemaType.INTEGER
}

export function isCodegenBooleanSchema(schema: CodegenSchema): schema is CodegenBooleanSchema {
	return schema.schemaType === CodegenSchemaType.BOOLEAN
}

export function isCodegenStringSchema(schema: CodegenSchema): schema is CodegenStringSchema {
	return schema.schemaType === CodegenSchemaType.STRING || schema.schemaType == CodegenSchemaType.DATE ||
		schema.schemaType === CodegenSchemaType.DATETIME || schema.schemaType === CodegenSchemaType.TIME
}

export function isCodegenArraySchema(schema: CodegenSchema): schema is CodegenArraySchema {
	return schema.schemaType === CodegenSchemaType.ARRAY
}

export function isCodegenMapSchema(schema: CodegenSchema): schema is CodegenMapSchema {
	return schema.schemaType === CodegenSchemaType.MAP
}

export function isCodegenEnumSchema(schema: CodegenSchema): schema is CodegenEnumSchema {
	return schema.schemaType === CodegenSchemaType.ENUM
}

export function isCodegenObjectSchema(schema: CodegenSchema): schema is CodegenObjectSchema {
	return schema.schemaType === CodegenSchemaType.OBJECT
}

export function isCodegenNamedSchema(schema: CodegenSchema): schema is CodegenNamedSchema {
	return !!schema.name && !!schema.scopedName
}

export function isCodegenScope(schema: CodegenSchema): schema is CodegenScope & CodegenSchema {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return (schema as any).scopedName
}
