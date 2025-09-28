import { CodegenSchema, isCodegenObjectLikeSchema, isCodegenArraySchema } from '@openapi-generator-plus/types'

/**
 * Return the "value" schema for a metadata schema that might be either single-valued or an array.
 * Otherwise return undefined if such a schema cannot be found.
 * @param schema 
 * @returns 
 */
export function valueSchemaForMetadataSchema(schema: CodegenSchema): CodegenSchema | undefined {
	if (isCodegenObjectLikeSchema(schema) && schema.properties && schema.properties.value) {
		return schema.properties.value.schema
	} else if (isCodegenArraySchema(schema) && schema.component && isCodegenObjectLikeSchema(schema.component.schema) && schema.component.schema.properties && schema.component.schema.properties.value) {
		return schema.component.schema.properties.value.schema
	} else {
		return undefined
	}
}
