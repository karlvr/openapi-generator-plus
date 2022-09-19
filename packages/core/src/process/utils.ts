import { isOpenAPIReferenceObject } from '../openapi-type-guards'
import { InternalCodegenState } from '../types'
import { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'
import { CodegenDefaultValueOptions, CodegenInitialValueOptions, CodegenLiteralValueOptions, CodegenLogLevel, CodegenTypeOptions, CodegenSchema, CodegenSchemaInfo, CodegenSchemaUsage, CodegenValue, isCodegenSchemaUsage, CodegenNativeTypeUsageOptions } from '@openapi-generator-plus/types'
import { toCodegenOperations } from './paths'
import { baseSuggestedNameForRelatedSchemas } from './schema/utils'

/**
 * Resolve anything that may also be a ReferenceObject to the base type.
 * @param ob 
 * @param state 
 */
export function resolveReference<T>(ob: T | OpenAPIV3_1.ReferenceObject | OpenAPIV3.ReferenceObject | OpenAPIV2.ReferenceObject, state: InternalCodegenState): T {
	const seen = new Set()
	while (isOpenAPIReferenceObject(ob)) {
		if (seen.has(ob)) {
			throw new Error('Recursive $ref')
		}
		seen.add(ob)
		
		ob = state.$refs.get(ob.$ref)
	}
	return ob
}

/**
 * Extract _just_ the CodegenTypeInfo properties from the source.
 */
function extractCodegenTypeOptions(source: CodegenSchema): CodegenTypeOptions {
	return {
		type: source.type,
		format: source.format,
		schemaType: source.schemaType,
	}
}

function extractCodegenNativeTypeUsageOptions(usage: CodegenSchemaUsage): CodegenNativeTypeUsageOptions {
	return {
		...extractCodegenTypeOptions(usage.schema),
		required: usage.required,
		nullable: usage.nullable,
		readOnly: usage.readOnly,
		writeOnly: usage.writeOnly,
	}
}

export function equalCodegenTypeInfo(a: CodegenSchema | CodegenSchemaUsage, b: CodegenSchema | CodegenSchemaUsage): boolean {
	if (isCodegenSchemaUsage(a)) {
		a = a.schema
	}
	if (isCodegenSchemaUsage(b)) {
		b = b.schema
	}
	return (
		a.type === b.type &&
		a.format === b.format &&
		a.schemaType === b.schemaType &&
		(a.component === b.component || (
			!!a.component && !!b.component && a.component.nativeType.equals(b.component.nativeType)
		))
	)
}

export function typeInfoToString(a: CodegenSchema | CodegenSchemaUsage): string {
	if (isCodegenSchemaUsage(a)) {
		a = a.schema
	}
	let result = `${a.type} (`
	if (a.format) {
		result += `format = ${a.format}, `
	}
	result += `schemaType = ${a.schemaType}`
	if (a.component) {
		result += `, component = ${a.component.nativeType}`
	}
	result += ')'
	return result
}

/**
 * Extract _just_ the CodegenSchemaUsage properties from the source.
 */
export function extractCodegenSchemaInfo(source: CodegenSchemaInfo): CodegenSchemaInfo {
	return {
		nativeType: source.nativeType,
		nullable: source.nullable,
		readOnly: source.readOnly,
		writeOnly: source.writeOnly,
		deprecated: source.deprecated,
	}
}

export function extractCodegenSchemaUsage(source: CodegenSchemaUsage): CodegenSchemaUsage {
	return {
		...extractCodegenSchemaInfo(source),

		required: source.required,
		schema: source.schema,
		examples: source.examples,
		defaultValue: source.defaultValue,
	}
}

export function coalesce<T>(...values: (T | undefined)[]): T | undefined {
	for (const value of values) {
		if (value !== undefined) {
			return value
		}
	}
	return undefined
}

/**
 * Convert a `$ref` into a name that could be turned into a type.
 * @param $ref 
 */
export function nameFromRef($ref: string, state: InternalCodegenState): string {
	const pathRef = pathPartOfRef($ref)
	const relativeRef = relativePartOfRef($ref)
	
	if (!relativeRef) {
		return 'Unknown'
	}

	const components = relativeRef.split('/')

	/* OpenAPI v3 schemas */
	if (components.length > 2 && components[0] === 'components' && components[1] === 'schemas') {
		return components[components.length - 1]
	}

	/* OpenAPI v2 schemas */
	if (components.length > 1 && components[0] === 'definitions') {
		return components[components.length - 1]
	}

	/* References to things in paths */
	if (components.length && components[0] === 'paths') {
		/* References to responses */
		if (components.length === 5 && components[3] === 'responses') {
			const pathItem = state.$refs.get(`${pathRef}#/paths/${components[1]}`) as OpenAPIV3.PathItemObject
			if (pathItem) {
				const operations = toCodegenOperations(unescape(components[1]), pathItem, state)
				const operation = operations.find(op => op.httpMethod === components[2].toUpperCase())
				if (operation && operation.responses) {
					const response = operation.responses[components[4]]
					if (response && response.defaultContent && response.defaultContent.schema) {
						const suggestedName = baseSuggestedNameForRelatedSchemas(response.defaultContent.schema)
						if (suggestedName !== null) {
							return suggestedName
						}
					}
					if (response && response.defaultContent && response.defaultContent.nativeType) {
						return response.defaultContent.nativeType.nativeType
					}
				}
			}
		} else if (components.length === 8 && components[3] === 'responses' && components[5] === 'content' && components[7] === 'schema') {
			const pathItem = state.$refs.get(`${pathRef}#/paths/${components[1]}`) as OpenAPIV3.PathItemObject
			if (pathItem) {
				const operations = toCodegenOperations(unescape(components[1]), pathItem, state)
				const operation = operations.find(op => op.httpMethod === components[2].toUpperCase())
				if (operation && operation.responses) {
					const response = operation.responses[components[4]]
					if (response && response.contents) {
						const content = response.contents.find(co => co.mediaType.mediaType === unescape(components[6]))
						if (content && content.schema) {
							const suggestedName = baseSuggestedNameForRelatedSchemas(content.schema)
							if (suggestedName !== null) {
								return suggestedName
							}
						}
						if (content && content.nativeType) {
							return content.nativeType.nativeType
						}
					}
				}
			}
		}
	}

	/* Fallback */
	return components[components.length - 1]
}

function pathPartOfRef($ref: string): string | null {
	const i = $ref.indexOf('#')
	if (i !== -1) {
		return $ref.substring(0, i)
	} else {
		return $ref
	}
}

function relativePartOfRef($ref: string): string | null {
	const i = $ref.indexOf('#')
	if (i !== -1) {
		$ref = $ref.substring(i + 1)
		if ($ref.startsWith('/')) {
			$ref = $ref.substring(1)
		}
		return $ref
	} else {
		return null
	}
}

/**
 * Convert any value to a boolean.
 * Parsing a schema sometimes results in a 'yes' or a 'no' when a boolean is expected.
 * @param value any value
 * @returns 
 */
export function convertToBoolean(value: unknown, defaultValue: boolean): boolean
export function convertToBoolean(value: unknown, defaultValue: null): boolean | null
export function convertToBoolean(value: unknown): boolean | undefined
export function convertToBoolean(value: unknown, defaultValue?: boolean | null): boolean | undefined | null {
	if (typeof value === 'undefined' || value === null) {
		return defaultValue
	}
	if (typeof value === 'string') {
		if (value === 'true' || value === 'yes') {
			return true
		} else if (value === 'false' || value === 'no' || !value) {
			return false
		} else {
			throw new Error(`Unexpected boolean string value: ${value}`)
		}
	}
	if (typeof value === 'boolean') {
		return value
	}
	throw new Error(`Unexpected boolean value: ${value}`)
}

export function convertToNumber(value: unknown): number | null {
	if (typeof value === 'number') {
		return value
	} else {
		return null
	}
}

/**
 * Process a default value from the API schema into our default value type.
 * @param value 
 * @param schemaUsage 
 * @param state 
 * @returns 
 */
export function toDefaultValue(value: unknown, schemaUsage: CodegenSchemaUsage, state: InternalCodegenState): CodegenValue | null {
	if (value === undefined) {
		return null
	}

	const literalValue = state.generator.toLiteral(value, toCodegenLiteralValueOptions(schemaUsage))
	if (literalValue === null) {
		state.log(CodegenLogLevel.WARN, `Cannot format literal for default value "${value}"`)
		return null
	}

	return {
		value,
		literalValue,
	}
}

export function toCodegenDefaultValueOptions(usage: CodegenSchemaUsage): CodegenDefaultValueOptions {
	return {
		...extractCodegenNativeTypeUsageOptions(usage),
		schemaType: usage.schema.schemaType,
		nativeType: usage.nativeType,
		component: usage.schema.component,
	}
}

export function toCodegenLiteralValueOptions(usage: CodegenSchemaUsage): CodegenLiteralValueOptions {
	return toCodegenDefaultValueOptions(usage)
}

export function toCodegenInitialValueOptions(usage: CodegenSchemaUsage): CodegenInitialValueOptions {
	return {
		...toCodegenDefaultValueOptions(usage),
		defaultValue: usage.defaultValue,
	}
}
