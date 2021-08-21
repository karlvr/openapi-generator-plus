import { CodegenSchema, CodegenScope, isCodegenNamedSchema } from '@openapi-generator-plus/types'
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

export function addToScope(schema: CodegenSchema, scope: CodegenScope | null, state: InternalCodegenState): void {
	if (!isCodegenNamedSchema(schema)) {
		throw new Error(`Cannot add schema without a name to a scope: ${JSON.stringify(schema)}`)
	}

	if (scope) {
		if (!scope.schemas) {
			scope.schemas = idx.create()
		}
		idx.set(scope.schemas, schema.name, schema)
	} else {
		idx.set(state.schemas, schema.name, schema)
	}
}

/**
 * Add the result to the knownSchemas to avoid generating again, and returns the canonical schema.
 * If theres already a known schema for the given schema, the already existing version is returned.
 * This helps to dedupe what we generate.
 */
export function addToKnownSchemas<T extends CodegenSchema>(schema: OpenAPIX.SchemaObject, generatedSchema: T, state: InternalCodegenState): T {
	const existing = state.knownSchemas.get(schema)
	if (existing) {
		return existing as T
	} else {
		state.knownSchemas.set(schema, generatedSchema)
		return generatedSchema
	}
}
