import { CodegenNamedSchema, CodegenObjectSchema, CodegenProperties, CodegenProperty, CodegenSchema, CodegenScope, isCodegenNamedSchema, isCodegenScope } from '@openapi-generator-plus/types'
import { isOpenAPIv3SchemaObject } from '../../openapi-type-guards'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import * as idx from '@openapi-generator-plus/indexed-type'
import { fullyQualifiedName } from './naming'

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
 * Returns the scope of the given schema
 * @param schema 
 * @param state 
 * @returns a CodegenScope, or null if it is in the global scope
 */
export function scopeOf(schema: CodegenNamedSchema, state: InternalCodegenState): CodegenScope | null {
	const scopedName = schema.scopedName
	if (scopedName.length === 1) {
		return null
	}
	
	let result = idx.get(state.schemas, scopedName[0])
	for (let i = 1; i < scopedName.length; i++) {
		if (!result) {
			break
		} else if (isCodegenScope(result)) {
			if (result.schemas) {
				result = idx.get(result.schemas, scopedName[i])
			} else {
				result = undefined
				break
			}
		} else {
			break
		}
	}

	if (result && isCodegenScope(result)) {
		return result
	} else {
		throw new Error(`Could not lookup scope of ${fullyQualifiedName(scopedName)}`)
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

/**
 * Return all of the unique properties, including inherited properties, for a model, where properties
 * in submodels override any same-named properties in parent models.
 * @param model 
 * @param result 
 */
export function uniquePropertiesIncludingInherited(model: CodegenObjectSchema, result: CodegenProperties = idx.create()): CodegenProperties {
	if (model.parents) {
		for (const aParent of model.parents) {
			uniquePropertiesIncludingInherited(aParent, result)
		}
	}
	if (model.properties) {
		idx.merge(result, model.properties)
	}

	return result
}

/**
 * Finds and removes the named property from the given set of properties.
 * @param properties the properties to look in
 * @param name the name of the property
 * @returns a CodegenProperty or undefined if not found
 */
export function removeProperty(schema: CodegenObjectSchema, name: string): CodegenProperty | undefined {
	if (!schema.properties) {
		return undefined
	}

	const entry = idx.findEntry(schema.properties, p => p.name === name)
	if (!entry) {
		return undefined
	}

	idx.remove(schema.properties, entry[0])
	if (idx.isEmpty(schema.properties)) {
		schema.properties = null
	}

	return entry[1]
}
