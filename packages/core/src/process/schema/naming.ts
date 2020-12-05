import { CodegenSchemaNameOptions, CodegenScope } from '@openapi-generator-plus/types'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { toCodegenSchemaTypeFromSchema } from './schema-type'
import { nameFromRef } from '../utils'

interface ScopedModelInfo {
	scopedName: string[]
	scope: CodegenScope | null
}

export function toScopedName($ref: string | undefined, suggestedName: string, scope: CodegenScope | null, schema: OpenAPIX.SchemaObject, state: InternalCodegenState): ScopedModelInfo {
	if ($ref) {
		/* We always want referenced schemas to be at the top-level */
		scope = null

		suggestedName = nameFromRef($ref)
	}

	const vendorExtensions = toCodegenVendorExtensions(schema)
	/* Support vendor extension to override the automatic naming of schemas */
	if (vendorExtensions && vendorExtensions['x-schema-name']) {
		suggestedName = vendorExtensions['x-schema-name']
	}

	const nameOptions: CodegenSchemaNameOptions = {
		schemaType: toCodegenSchemaTypeFromSchema(schema),
	}
	let name = state.generator.toSchemaName(suggestedName, nameOptions)

	if (scope) {
		/* Check that our name is unique in our scope, as some languages (Java) don't allow an inner class to shadow an ancestor */
		const originalName = name
		let iteration = 0
		while (scope.scopedName.indexOf(name) !== -1) {
			iteration += 1
			name = state.generator.toIteratedSchemaName(originalName, scope.scopedName, iteration)
		}

		return {
			scopedName: [...scope.scopedName, name],
			scope,
		}
	} else {
		return {
			scopedName: [name],
			scope: null,
		}
	}
}

export function toUniqueScopedName($ref: string | undefined, suggestedName: string, scope: CodegenScope | null, schema: OpenAPIX.SchemaObject, state: InternalCodegenState): ScopedModelInfo {
	const result = toScopedName($ref, suggestedName, scope, schema, state)

	const reservedName = $ref ? state.reservedNames[$ref] : undefined
	if (reservedName !== fullyQualifiedName(result.scopedName)) {
		/* Model types that aren't defined in the spec need to be made unique */
		result.scopedName = uniqueName(result.scopedName, state)
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
 * Returns a unique model name for a proposed schema name.
 * @param scopeNamed the scoped schema name
 * @param state the state
 */
function uniqueName(scopedName: string[], state: InternalCodegenState): string[] {
	if (!state.usedModelFullyQualifiedNames[fullyQualifiedName(scopedName)]) {
		return scopedName
	}

	const proposedName = scopedName[scopedName.length - 1]
	const scopeNames = scopedName.slice(0, scopedName.length - 1)
	let name = proposedName
	let iteration = 0
	do {
		iteration += 1
		name = state.generator.toIteratedSchemaName(proposedName, scopeNames, iteration)
	} while (state.usedModelFullyQualifiedNames[fullyQualifiedName([...scopeNames, name])])

	return [...scopeNames, name]
}
