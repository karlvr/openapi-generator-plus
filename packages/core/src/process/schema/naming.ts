import { CodegenNamedSchema, CodegenSchema, CodegenSchemaNameOptions, CodegenSchemaType, CodegenScope, IndexedCollectionType } from '@openapi-generator-plus/types'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { nameFromRef } from '../utils'
import * as idx from '@openapi-generator-plus/indexed-type'

export interface ScopedModelInfo {
	name: string
	scopedName: string[]
	serializedName: string | null
	scope: CodegenScope | null
}

function toScopedName($ref: string | undefined, suggestedName: string, scope: CodegenScope | null, schema: OpenAPIX.SchemaObject | undefined, schemaType: CodegenSchemaType, state: InternalCodegenState): ScopedModelInfo {
	if ($ref) {
		/* We always want referenced schemas to be at the top-level */
		scope = null

		suggestedName = nameFromRef($ref, state)
	}

	if (schema) {
		const vendorExtensions = toCodegenVendorExtensions(schema)
		/* Support vendor extension to override the automatic naming of schemas */
		if (vendorExtensions && vendorExtensions['x-schema-name']) {
			suggestedName = vendorExtensions['x-schema-name']
		}
	}

	const nameOptions: CodegenSchemaNameOptions = {
		schemaType,
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
			serializedName,
			scope,
		}
	} else {
		return {
			name,
			scopedName: [name],
			serializedName,
			scope: null,
		}
	}
}

export function toUniqueScopedName($ref: string | undefined, suggestedName: string, scope: CodegenScope | null, schema: OpenAPIX.SchemaObject | undefined, schemaType: CodegenSchemaType, state: InternalCodegenState): ScopedModelInfo {
	const result = toScopedName($ref, suggestedName, scope, schema, schemaType, state)

	const reservedName = $ref ? state.reservedSchemaNames[$ref] : undefined
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

type ExtractNamingKeys = 'name' | 'scopedName' | 'serializedName'

export function extractNaming(naming: ScopedModelInfo): Pick<CodegenNamedSchema, ExtractNamingKeys>
export function extractNaming(naming: ScopedModelInfo | null): Pick<CodegenSchema, ExtractNamingKeys>
export function extractNaming(naming: ScopedModelInfo | null): Pick<CodegenSchema, ExtractNamingKeys> {
	if (!naming) {
		return {
			name: null,
			scopedName: null,
			serializedName: null,
		}
	}

	return {
		name: naming.name,
		scopedName: naming.scopedName,
		serializedName: naming.serializedName,
	}
}

type TestUniqueNameFunc = (name: string, parentNames: string[] | undefined) => boolean

export function toUniqueName(suggestedName: string, parentNames: string[] | undefined, existingNames: IndexedCollectionType<unknown> | null, state: InternalCodegenState): string
export function toUniqueName(suggestedName: string, parentNames: string[] | undefined, testUniqueName: TestUniqueNameFunc, state: InternalCodegenState): string 
export function toUniqueName(suggestedName: string, parentNames: string[] | undefined, testOrData: IndexedCollectionType<unknown> | TestUniqueNameFunc | null, state: InternalCodegenState): string {
	if (!testOrData) {
		return suggestedName
	}

	const testUniqueName = typeof testOrData === 'function' ? testOrData : (possibleName: string) => !idx.has(testOrData, possibleName)

	let name = suggestedName
	let iteration = 0
	while (!testUniqueName(name, parentNames)) {
		iteration += 1
		name = state.generator.toIteratedSchemaName(suggestedName, parentNames, iteration)
	}
	return name
}
