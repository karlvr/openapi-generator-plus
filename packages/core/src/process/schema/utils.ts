import { CodegenAllOfSchema, CodegenAnyOfSchema, CodegenInterfaceSchema, CodegenNamedSchema, CodegenObjectLikeSchemas, CodegenObjectSchema, CodegenOneOfSchema, CodegenProperties, CodegenProperty, CodegenSchema, CodegenScope, CodegenWrapperSchema, isCodegenInterfaceSchema, isCodegenNamedSchema, isCodegenObjectSchema, isCodegenScope } from '@openapi-generator-plus/types'
import { isOpenAPIv3SchemaObject } from '../../openapi-type-guards'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import * as idx from '@openapi-generator-plus/indexed-type'
import { fullyQualifiedName } from './naming'
import { convertToBoolean } from '../utils'

/**
 * Extract the common attributes that we use from OpenAPI schema in our CodegenSchema.
 * @param apiSchema an OpenAPI schema
 * @param state 
 */
export function extractCodegenSchemaCommon(apiSchema: OpenAPIX.SchemaObject, state: InternalCodegenState): Pick<CodegenSchema, 'description' | 'title' | 'readOnly' | 'nullable' | 'writeOnly' | 'deprecated'> {
	return {
		description: apiSchema.description || null,
		title: apiSchema.title || null,

		readOnly: convertToBoolean(apiSchema.readOnly, false),
		nullable: isOpenAPIv3SchemaObject(apiSchema, state.specVersion) ? convertToBoolean(apiSchema.nullable, false) : false,
		writeOnly: isOpenAPIv3SchemaObject(apiSchema, state.specVersion) ? convertToBoolean(apiSchema.writeOnly, false) : false,
		deprecated: isOpenAPIv3SchemaObject(apiSchema, state.specVersion) ? convertToBoolean(apiSchema.deprecated, false) : false,
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
export function addToKnownSchemas<T extends CodegenSchema>(apiSchema: OpenAPIX.SchemaObject, schema: T, state: InternalCodegenState): T {
	const existing = state.knownSchemas.get(apiSchema)
	if (existing) {
		return existing as T
	} else {
		state.knownSchemas.set(apiSchema, schema)
		return schema
	}
}

/**
 * Return all of the unique properties, including inherited properties, for a model, where properties
 * in submodels override any same-named properties in parent models.
 * @param schema 
 * @param result 
 */
export function uniquePropertiesIncludingInherited(schema: CodegenObjectSchema, result: CodegenProperties = idx.create()): CodegenProperties {
	if (schema.parents) {
		for (const aParent of schema.parents) {
			uniquePropertiesIncludingInherited(aParent, result)
		}
	}
	if (schema.properties) {
		idx.merge(result, schema.properties)
	}

	return result
}

/**
 * Finds and removes the named property from the given set of properties.
 * @param properties the properties to look in
 * @param serializedName the serialized name of the property
 * @returns a CodegenProperty or undefined if not found
 */
export function removeProperty(schema: CodegenObjectLikeSchemas, serializedName: string): CodegenProperty | undefined {
	if (!schema.properties) {
		return undefined
	}

	const entry = idx.get(schema.properties, serializedName)
	if (!entry) {
		return undefined
	}

	idx.remove(schema.properties, serializedName)
	if (idx.isEmpty(schema.properties)) {
		/* Check for schemas that share these properties */
		if (isCodegenObjectSchema(schema) && schema.interface && schema.interface.properties === schema.properties) {
			schema.interface.properties = null
		}
		if (isCodegenInterfaceSchema(schema) && schema.implementation && schema.implementation.properties === schema.properties) {
			schema.implementation.properties = null
		}
		schema.properties = null
	}

	return entry
}

/**
 * Looks for the named property in the current schema and any parents etc.
 * @param schema 
 * @param serializedName 
 * @returns 
 */
export function findProperty(schema: CodegenObjectLikeSchemas, serializedName: string): CodegenProperty | undefined {
	const open = [schema]
	for (const aSchema of open) {
		if (aSchema.properties) {
			const property = idx.get(aSchema.properties, serializedName)
			if (property) {
				return property
			}
		}

		if (isCodegenObjectSchema(schema) && schema.parents) {
			for (const parent of schema.parents) {
				if (open.indexOf(parent) === -1) {
					open.push(parent)
				}
			}
		} else if (isCodegenInterfaceSchema(schema) && schema.parents) {
			for (const parent of schema.parents) {
				if (open.indexOf(parent) === -1) {
					open.push(parent)
				}
			}
		}
	}

	return undefined
}

export function addChildObjectSchema(parent: CodegenObjectSchema, child: CodegenObjectSchema): void {
	if (!parent.children) {
		parent.children = []
	}
	parent.children.push(child)

	if (!child.parents) {
		child.parents = []
	}
	child.parents.push(parent)
}

export function addChildInterfaceSchema(parent: CodegenInterfaceSchema, child: CodegenInterfaceSchema): void {
	if (!parent.children) {
		parent.children = []
	}
	parent.children.push(child)

	if (!child.parents) {
		child.parents = []
	}
	child.parents.push(parent)
}

export function addImplementor(parent: CodegenInterfaceSchema, child: CodegenObjectSchema | CodegenAllOfSchema | CodegenAnyOfSchema | CodegenOneOfSchema | CodegenWrapperSchema): void {
	if (!parent.implementors) {
		parent.implementors = []
	}
	parent.implementors.push(child)

	if (!child.implements) {
		child.implements = []
	}
	child.implements.push(parent)
}
