import { CodegenNamedSchema, CodegenSchema, CodegenSchemaNameOptions, CodegenSchemaPurpose, CodegenSchemaType, CodegenScope, IndexedCollectionType } from '@openapi-generator-plus/types'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { nameFromRef } from '../utils'
import * as idx from '@openapi-generator-plus/indexed-type'
import { reservedSchemaName } from './utils'

export interface ScopedModelInfo {
	name: string
	scopedName: string[]
	serializedName: string | null
	originalName: string | null
	originalScopedName: string[] | null
	scope: CodegenScope | null
	anonymous: boolean
	/** The purpose for which the schema was created */
	purpose: CodegenSchemaPurpose
	$ref: string | undefined
	moveToGlobalScope?: () => void
}

function toScopedName($ref: string | undefined, suggestedName: string, scope: CodegenScope | null, apiSchema: OpenAPIX.SchemaObject | undefined, schemaType: CodegenSchemaType, purpose: CodegenSchemaPurpose, state: InternalCodegenState): ScopedModelInfo {
	if ($ref) {
		/* We always want referenced schemas to be at the top-level */
		scope = null

		suggestedName = nameFromRef($ref, state)
	}

	if (apiSchema) {
		const vendorExtensions = toCodegenVendorExtensions(apiSchema)
		/* Support vendor extension to override the automatic naming of schemas */
		if (vendorExtensions && vendorExtensions['x-schema-name']) {
			suggestedName = String(vendorExtensions['x-schema-name'])
		}
	}

	const nameOptions: CodegenSchemaNameOptions = {
		schemaType,
		scope,
	}
	let name = state.generator.toSchemaName(suggestedName, nameOptions)

	const serializedName = $ref ? (nameFromRef($ref, state) || null) : null

	if (scope) {
		/* Check that our name is unique in our scope, as some languages (Java) don't allow an inner class to shadow the
		   name of a containing class.
		 */
		name = toUniqueName(name, scope.scopedName, possibleName => scope!.scopedName.indexOf(possibleName) === -1, state)

		return {
			name,
			scopedName: [...scope.scopedName, name],
			originalScopedName: scope.originalScopedName ? [...scope.originalScopedName, suggestedName] : null,
			serializedName,
			originalName: suggestedName,
			scope,
			anonymous: serializedName === null,
			purpose,
			$ref,
			moveToGlobalScope: function() {
				const newScopedName = toScopedName($ref, this.originalScopedName ? this.originalScopedName.join('_') : suggestedName, null, apiSchema, schemaType, purpose, state)
				Object.assign(this, newScopedName)
			},
		}
	} else {
		return {
			name,
			scopedName: [name],
			originalScopedName: [suggestedName],
			serializedName,
			originalName: suggestedName,
			scope: null,
			anonymous: serializedName === null,
			purpose,
			$ref,
		}
	}
}

export function toUniqueScopedName($ref: string | undefined, suggestedName: string, scope: CodegenScope | null, apiSchema: OpenAPIX.SchemaObject | undefined, schemaType: CodegenSchemaType, purpose: CodegenSchemaPurpose, state: InternalCodegenState): ScopedModelInfo {
	const result = toScopedName($ref, suggestedName, scope, apiSchema, schemaType, purpose, state)

	const reservedName = reservedSchemaName($ref, state)
	if (reservedName !== fullyQualifiedName(result.scopedName)) {
		/* Model types that aren't defined in the spec need to be made unique */
		result.scopedName = uniqueScopedName(result.scopedName, state)
		result.name = result.scopedName[result.scopedName.length - 1]
	}

	return result
}

/**
 * Returns a fully qualified schema name using an internal format for creating fully qualified
 * model names. This format does not need to reflect a native format as it is only used internally
 * to track unique schema names.
 * @param scopedName the scoped schema name
 */
export function fullyQualifiedName(scopedName: string[]): string {
	return scopedName.join('.')
}

/**
 * Record that the given schema name has been used.
 * @param scopedName
 * @param state 
 */
export function usedSchemaName(scopedName: string[], state: InternalCodegenState): void {
	state.usedFullyQualifiedSchemaNames[fullyQualifiedName(scopedName)] = true
}

/**
 * Returns a unique model name for a proposed schema name.
 * @param scopeNamed the scoped schema name
 * @param state the state
 */
function uniqueScopedName(scopedName: string[], state: InternalCodegenState): string[] {
	const proposedName = scopedName[scopedName.length - 1]
	const parentNames = scopedName.slice(0, scopedName.length - 1)

	const name = toUniqueName(proposedName, parentNames, possibleName => !state.usedFullyQualifiedSchemaNames[fullyQualifiedName([...parentNames, possibleName])], state)
	return [...parentNames, name]
}

type ExtractNamingKeys = 'name' | 'scopedName' | 'originalScopedName' | 'serializedName' | 'originalName' | 'anonymous' | 'purpose'

export function extractNaming(naming: ScopedModelInfo): Pick<CodegenNamedSchema, ExtractNamingKeys>
export function extractNaming(naming: ScopedModelInfo | null): Pick<CodegenSchema, ExtractNamingKeys>
export function extractNaming(naming: ScopedModelInfo | null): Pick<CodegenSchema, ExtractNamingKeys> {
	if (!naming) {
		return {
			name: null,
			scopedName: null,
			originalScopedName: null,
			serializedName: null,
			originalName: null,
			anonymous: null,
			purpose: CodegenSchemaPurpose.UNKNOWN,
		}
	}

	return {
		name: naming.name,
		scopedName: naming.scopedName,
		originalScopedName: naming.originalScopedName,
		serializedName: naming.serializedName,
		originalName: naming.originalName,
		anonymous: naming.anonymous,
		purpose: naming.purpose,
	}
}

type TestUniqueNameFunc = (name: string, parentNames: string[] | undefined) => boolean
interface WithName {
	name: string
}

export function toUniqueName(suggestedName: string, parentNames: string[] | undefined, existingNames: IndexedCollectionType<WithName> | null, state: InternalCodegenState): string
export function toUniqueName(suggestedName: string, parentNames: string[] | undefined, testUniqueName: TestUniqueNameFunc, state: InternalCodegenState): string 
export function toUniqueName(suggestedName: string, parentNames: string[] | undefined, testOrData: IndexedCollectionType<WithName> | TestUniqueNameFunc | null, state: InternalCodegenState): string {
	if (!testOrData) {
		return suggestedName
	}

	const testUniqueName = typeof testOrData === 'function' ? testOrData : (possibleName: string) => uniqueNameInIndexedCollection(possibleName, testOrData)

	let name = suggestedName
	let iteration = 0
	while (!testUniqueName(name, parentNames)) {
		iteration += 1
		name = state.generator.toIteratedSchemaName(suggestedName, parentNames, iteration)
	}
	return name
}

/**
 * Returns `true` if the given name is unique in the collection of objects with names.
 * @param name a possible name
 * @param collection a collection of objects with names
 * @returns 
 */
function uniqueNameInIndexedCollection(name: string, collection: IndexedCollectionType<WithName>): boolean {
	for (const value of idx.allValues(collection)) {
		if (value.name === name) {
			return false
		}
	}
	return true
}

/**
 * Check whether two schemas are the same or whether the first contains the second in its nested schemas.
 * @param possibleAncestor 
 * @param possibleDescendent 
 * @returns 
 */
export function checkContainsRelationship(possibleAncestor: CodegenSchema, possibleDescendent: CodegenSchema | CodegenScope): boolean {
	if (possibleAncestor === possibleDescendent as unknown) {
		return true
	}

	const scopedAncestorName = possibleAncestor.scopedName
	if (scopedAncestorName === null) {
		return false
	}
	const scopedDescendentName = possibleDescendent.scopedName
	if (scopedDescendentName === null) {
		return false
	}
	if (scopedAncestorName.length > scopedDescendentName.length) {
		return false
	}

	for (let i = 0; i < scopedAncestorName.length; i++) {
		if (scopedAncestorName[i] !== scopedDescendentName[i]) {
			return false
		}
	}
	return true
}
