import { isOpenAPIReferenceObject } from '../openapi-type-guards'
import { InternalCodegenState } from '../types'
import { OpenAPIV2, OpenAPIV3 } from 'openapi-types'
import { CodegenSchemaInfo, CodegenSchemaUse, CodegenTypeInfo } from '@openapi-generator-plus/types'

/**
 * Resolve anything that may also be a ReferenceObject to the base type.
 * @param ob 
 * @param state 
 */
export function resolveReference<T>(ob: T | OpenAPIV3.ReferenceObject | OpenAPIV2.ReferenceObject, state: InternalCodegenState): T {
	if (isOpenAPIReferenceObject(ob)) {
		return state.$refs.get(ob.$ref)
	} else {
		return ob
	}
}

export function toUniqueName(suggestedName: string, existingNames: string[] | undefined): string {
	if (!existingNames) {
		return suggestedName
	}

	const baseName = suggestedName
	let iteration = 0
	while (existingNames.indexOf(suggestedName) !== -1) {
		iteration += 1
		suggestedName = `${baseName}${iteration}`
	}
	return suggestedName
}

/**
 * Extract _just_ the CodegenTypeInfo properties from the source.
 */
export function extractCodegenTypeInfo(source: CodegenTypeInfo): CodegenTypeInfo {
	return {
		type: source.type,
		format: source.format,
		schemaType: source.schemaType,

		nativeType: source.nativeType,
		componentSchema: source.componentSchema,
	}
}

/**
 * Extract _just_ the CodegenSchemaUse properties from the source.
 */
export function extractCodegenSchemaInfo(source: CodegenSchemaInfo): CodegenSchemaInfo {
	return {
		...extractCodegenTypeInfo(source),

		nullable: source.nullable,
		readOnly: source.readOnly,
		writeOnly: source.writeOnly,
		deprecated: source.deprecated,
	}
}

export function extractCodegenSchemaUse(source: CodegenSchemaUse): CodegenSchemaUse {
	return {
		...extractCodegenSchemaInfo(source),

		required: source.required,
		schema: source.schema,
		examples: source.examples,
		defaultValue: source.defaultValue,
	}
}

/**
 * Convert a `$ref` into a name that could be turned into a type.
 * @param $ref 
 */
export function nameFromRef($ref: string): string | undefined {
	const i = $ref.indexOf('#')
	if (i === -1) {
		return undefined
	}

	$ref = $ref.substring(i + 1)
	const components = $ref.split('/')
	return components[components.length - 1]
}

export function coalesce<T>(...values: (T | undefined)[]): T | undefined {
	for (const value of values) {
		if (value !== undefined) {
			return value
		}
	}
	return undefined
}
