import { CodegenAllOfSchema, CodegenAnyOfSchema, CodegenArraySchema, CodegenBooleanSchema, CodegenDiscriminatableSchema, CodegenDiscriminatorSchema, CodegenEnumSchema, CodegenInterfaceSchema, CodegenMapSchema, CodegenNamedSchema, CodegenNumericSchema, CodegenObjectLikeSchemas, CodegenObjectSchema, CodegenOneOfSchema, CodegenSchema, CodegenSchemaType, CodegenScope, CodegenStringSchema, CodegenWrapperSchema, CodegenSchemaUsage, CodegenHierarchySchema } from './types'

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

export function isCodegenInterfaceSchema(schema: CodegenSchema): schema is CodegenInterfaceSchema {
	return schema.schemaType === CodegenSchemaType.INTERFACE
}

export function isCodegenObjectLikeSchema(schema: CodegenSchema): schema is CodegenObjectLikeSchemas {
	return schema.schemaType === CodegenSchemaType.OBJECT || schema.schemaType === CodegenSchemaType.INTERFACE || schema.schemaType === CodegenSchemaType.HIERARCHY
}

export function isCodegenNamedSchema(schema: CodegenSchema): schema is CodegenNamedSchema {
	return !!schema.name && !!schema.scopedName
}

export function isCodegenScope(schema: CodegenSchema): schema is CodegenScope & CodegenSchema {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return (schema as any).scopedName
}

export function isCodegenCompositionSchema(schema: CodegenSchema): schema is CodegenAllOfSchema | CodegenAnyOfSchema | CodegenOneOfSchema {
	return schema.schemaType === CodegenSchemaType.ALLOF ||
		schema.schemaType === CodegenSchemaType.ANYOF ||
		schema.schemaType === CodegenSchemaType.ONEOF
}

export function isCodegenAllOfSchema(schema: CodegenSchema): schema is CodegenAllOfSchema {
	return schema.schemaType === CodegenSchemaType.ALLOF
}

export function isCodegenAnyOfSchema(schema: CodegenSchema): schema is CodegenAnyOfSchema {
	return schema.schemaType === CodegenSchemaType.ANYOF
}

export function isCodegenOneOfSchema(schema: CodegenSchema): schema is CodegenOneOfSchema {
	return schema.schemaType === CodegenSchemaType.ONEOF
}

export function isCodegenHierarchySchema(schema: CodegenSchema): schema is CodegenHierarchySchema {
	return schema.schemaType === CodegenSchemaType.HIERARCHY
}

export function isCodegenWrapperSchema(schema: CodegenSchema): schema is CodegenWrapperSchema {
	return schema.schemaType === CodegenSchemaType.WRAPPER
}

export function isCodegenDiscriminatorSchema(schema: CodegenSchema): schema is CodegenDiscriminatorSchema {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return (schema as any).discriminator !== undefined
}

export function isCodegenDiscriminatableSchema(schema: CodegenSchema): schema is CodegenDiscriminatableSchema {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return (schema as any).discriminatorValues !== undefined
}

export function isCodegenSchemaUsage(ob: unknown): ob is CodegenSchemaUsage {
	if (typeof ob !== 'object') {
		return false
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const anyOb = ob as any

	if (typeof anyOb.schema !== 'object') {
		return false
	}
	if (typeof anyOb.required !== 'boolean' || typeof anyOb.nullable !== 'boolean' || typeof anyOb.readOnly !== 'boolean'
		|| typeof anyOb.writeOnly !== 'boolean' || typeof anyOb.deprecated !== 'boolean') {
		return false
	}
	return true
}
