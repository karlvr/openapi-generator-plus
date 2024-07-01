import { CodegenSchema, isCodegenObjectLikeSchema, isCodegenArraySchema } from '@openapi-generator-plus/types'

/**
 * Return the "value" schema for a metadata schema that might be an object schema or array schema.
 * Otherwise return null if such a schema cannot be found.
 * @param schema 
 * @returns 
 */
export function valueSchemaForMetadataSchema(schema: CodegenSchema): CodegenSchema | null {
	if (isCodegenObjectLikeSchema(schema) && schema.properties && schema.properties.value) {
		return schema.properties.value.schema
	} else if (isCodegenArraySchema(schema) && schema.component && isCodegenObjectLikeSchema(schema.component.schema) && schema.component.schema.properties && schema.component.schema.properties.value) {
		return schema.component.schema.properties.value.schema
	} else {
		return null
	}
}