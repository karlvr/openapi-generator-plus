import { CodegenObjectSchema, CodegenSchema, CodegenSchemaType, CodegenScope } from '@openapi-generator-plus/types'
import { isOpenAPIv3SchemaObject } from '../../openapi-type-guards'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import * as idx from '@openapi-generator-plus/indexed-type'

/**
 * Extract the common attributes that we use from OpenAPI schema in our CodegenSchema.
 * @param schema an OpenAPI schema
 * @param state 
 */
export function extractCodegenSchemaCommon(schema: OpenAPIX.SchemaObject, state: InternalCodegenState): Pick<CodegenSchema, 'description' | 'title' | 'readOnly' | 'nullable' | 'writeOnly' | 'deprecated'> {
	return {
		description: schema.description || null,
		title: schema.title || null,

		readOnly: schema.readOnly !== undefined ? !!schema.readOnly : false,
		nullable: isOpenAPIv3SchemaObject(schema, state.specVersion) ? schema.nullable || false : false,
		writeOnly: isOpenAPIv3SchemaObject(schema, state.specVersion) ? schema.writeOnly || false : false,
		deprecated: isOpenAPIv3SchemaObject(schema, state.specVersion) ? schema.deprecated || false : false,
	}
}

export function isCodegenObjectSchema(schema: CodegenSchema): schema is CodegenObjectSchema {
	return schema.schemaType === CodegenSchemaType.OBJECT
}

export function addToScope(schema: CodegenSchema, scope: CodegenScope | null, state: InternalCodegenState): void {
	const name: string = (schema as any).name // FIXME once we move name to CodegenSchema
	if (scope) {
		if (!scope.schemas) {
			scope.schemas = idx.create()
		}
		idx.set(scope.schemas, name, schema as any) // FIXME once we allow all schemas here
	} else {
		idx.set(state.models, name, schema as any) // FIXME once we allow all schemas here
	}
}
