import { CodegenAllOfSchema, CodegenAnyOfSchema, CodegenDiscriminatableSchema, CodegenHierarchySchema, CodegenInterfaceSchema, CodegenNamedSchema, CodegenObjectLikeSchemas, CodegenObjectSchema, CodegenOneOfSchema, CodegenProperty, CodegenSchema, CodegenScope, CodegenWrapperSchema, isCodegenInterfaceSchema, isCodegenNamedSchema, isCodegenObjectSchema, isCodegenScope } from '@openapi-generator-plus/types'
import { isOpenAPIV2Document, isOpenAPIv3SchemaObject } from '../../openapi-type-guards'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import * as idx from '@openapi-generator-plus/indexed-type'
import { fullyQualifiedName, ScopedModelInfo } from './naming'
import { convertToBoolean } from '../utils'
import { debugStringify } from '@openapi-generator-plus/utils'
import path from 'path'
import { OpenAPI } from 'openapi-types'

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
		throw new Error(`Cannot add schema without a name to a scope: ${debugStringify(schema)}`)
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

function normaliseRef($ref: string, state: InternalCodegenState): string
function normaliseRef($ref: undefined, state: InternalCodegenState): undefined

/**
 * Normalise a $ref so that the path to external files is canonical, so we can use them to lookup known schemas.
 * @param $ref 
 * @param state 
 * @returns 
 */
function normaliseRef($ref: string | undefined, state: InternalCodegenState): string | undefined {
	if ($ref === undefined) {
		return undefined
	}

	if ($ref.startsWith('#')) {
		const base = state.$refs.paths()[0]
		return `${base}${$ref}`
	} else if (!$ref.startsWith('/')) {
		const base = state.$refs.paths()[0]
		const result = path.resolve(path.dirname(base), $ref)
		return result
	} else {
		return $ref
	}
}

export function findKnownSchema(apiSchema: OpenAPIX.SchemaObject, $ref: string | undefined, state: InternalCodegenState): CodegenSchema | undefined {
	const known = state.knownSchemas.get(apiSchema)
	if (known) {
		return known
	}

	if ($ref) {
		const known = state.knownSchemasByRef.get(normaliseRef($ref, state))
		if (known) {
			return known
		}
	}
	
	return undefined
}

/**
 * Add the result to the knownSchemas to avoid generating again, and returns the canonical schema.
 * If theres already a known schema for the given schema, the already existing version is returned.
 * This helps to dedupe what we generate.
 */
export function addToKnownSchemas<T extends CodegenSchema>(apiSchema: OpenAPIX.SchemaObject, schema: T, naming: ScopedModelInfo | null, state: InternalCodegenState): T {
	const existing = state.knownSchemas.get(apiSchema)
	if (!existing) {
		state.knownSchemas.set(apiSchema, schema)
	}

	let existingByRef: CodegenSchema | undefined
	if (naming?.$ref) {
		const normalisedRef = normaliseRef(naming.$ref, state)
		existingByRef = naming?.$ref ? state.knownSchemasByRef.get(normalisedRef) : undefined
		if (!existingByRef) {
			state.knownSchemasByRef.set(normalisedRef, schema)
		}
	}

	if (existing) {
		return existing as T
	} else if (existingByRef) {
		return existingByRef as T
	} else {
		return schema
	}
}

/**
 * Returns the interface, if any, that the property in the given schema implements in one of the interfaces the schema implements.
 * @param schema 
 * @param serializedName 
 * @returns 
 */
export function interfaceForProperty(schema: CodegenObjectLikeSchemas, serializedName: string): CodegenInterfaceSchema | undefined {
	if (isCodegenObjectSchema(schema)) {
		if (schema.implements !== null) {
			for (const anInterface of schema.implements) {
				const [property, propertySchema] = findPropertyAndSchema(anInterface, serializedName)
				if (property) {
					return propertySchema as CodegenInterfaceSchema
				}
			}
		}
	}

	return undefined
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

export function findProperty(schema: CodegenObjectLikeSchemas, serializedName: string): CodegenProperty | undefined {
	const [property] = findPropertyAndSchema(schema, serializedName)
	return property
}

/**
 * Looks for the named property in the current schema and any parents etc.
 * @param schema 
 * @param serializedName 
 * @returns 
 */
export function findPropertyAndSchema(schema: CodegenObjectLikeSchemas, serializedName: string): [CodegenProperty, CodegenSchema] | [undefined, undefined] {
	const open = [schema]
	for (const aSchema of open) {
		if (aSchema.properties) {
			const property = idx.get(aSchema.properties, serializedName)
			if (property) {
				return [property, aSchema]
			}
		}

		if (isCodegenObjectSchema(aSchema) && aSchema.parents) {
			for (const parent of aSchema.parents) {
				if (open.indexOf(parent) === -1) {
					open.push(parent)
				}
			}
		} else if (isCodegenInterfaceSchema(aSchema) && aSchema.parents) {
			for (const parent of aSchema.parents) {
				if (open.indexOf(parent) === -1) {
					open.push(parent)
				}
			}
		}
	}

	return [undefined, undefined]
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

export function addReservedSchemaName(schemaName: string, state: InternalCodegenState): void {
	const fqn = fullyQualifiedName([schemaName])
	const $ref = normaliseRef(refForSchemaName(schemaName, state), state)
	state.reservedSchemaNames[$ref] = fqn
}

export function reservedSchemaName($ref: string | undefined, state: InternalCodegenState): string | undefined {
	if (!$ref) {
		return undefined
	}
	$ref = normaliseRef($ref, state)
	return state.reservedSchemaNames[$ref]
}

/**
 * Returns the value of the `$ref` to use to refer to the given schema definition / component.
 * @param schemaName the name of a schema
 * @param state 
 */
export function refForSchemaName(schemaName: string, state: InternalCodegenState): string {
	return isOpenAPIV2Document(state.root) ? `#/definitions/${schemaName}` : `#/components/schemas/${schemaName}`
}

/**
 * Returns the value of the `$ref` to use to refer to the given schema in an external document.
 * @param path the path to the external schema
 * @param doc the external schema document
 * @param schemaName the name of the schema
 * @param state 
 * @returns 
 */
export function refForPathAndSchemaName(path: string, doc: OpenAPI.Document, schemaName: string, state: InternalCodegenState) {
	return normaliseRef(isOpenAPIV2Document(doc) ? `${path}#/definitions/${schemaName}` : `${path}#/components/schemas/${schemaName}`, state)
}

export function baseSuggestedNameForRelatedSchemas(schema: CodegenObjectSchema | CodegenHierarchySchema | CodegenDiscriminatableSchema): string
export function baseSuggestedNameForRelatedSchemas(schema: CodegenSchema): string | null

/**
 * Returns a base suggested name to use for schemas related to the given schema.
 * @param schema 
 * @returns 
 */
export function baseSuggestedNameForRelatedSchemas(schema: CodegenSchema): string | null {
	return schema.originalName || schema.serializedName || schema.name
}
