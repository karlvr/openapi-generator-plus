import { OpenAPI } from 'openapi-types'
import { CodegenLiteralValueOptions, CodegenSchemaType, CodegenGenerator } from '@openapi-generator-plus/types'
import { isOpenAPIV2Document, isOpenAPIV3Document } from './openapi-type-guards'
import { CodegenSpecVersion } from './types'
import { debugStringify } from '@openapi-generator-plus/utils'

export function toSpecVersion(root: OpenAPI.Document): CodegenSpecVersion {
	if (isOpenAPIV2Document(root)) {
		/* https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#swagger-object */
		if (root.swagger === '2.0') {
			return CodegenSpecVersion.OpenAPIV2
		} else {
			throw new Error(`Unsupported swagger specification version: ${root.swagger}`)
		}
	} else if (isOpenAPIV3Document(root)) {
		/* As per the spec we should be able to process any specification with the major version 3.
		 * https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.2.md#versions
		 */
		if (root.openapi.startsWith('3.') || root.openapi === '3') {
			return CodegenSpecVersion.OpenAPIV3
		} else {
			throw new Error(`Unsupported OpenAPI specification version: ${root.openapi}`)
		}
	} else {
		throw new Error(`API specification document not recognised as Swagger or OpenAPI: ${debugStringify(root)}`)
	}
}

export function stringLiteralValueOptions(generator: CodegenGenerator): CodegenLiteralValueOptions {
	return {
		type: 'string', 
		schemaType: CodegenSchemaType.STRING, 
		nativeType: generator.toNativeType({ type: 'string', schemaType: CodegenSchemaType.STRING }),
		component: null,
		required: true,
		nullable: false,
		readOnly: false,
		writeOnly: false,
	}
}

export type CompareFunction<T> = (a: T, b: T) => number

/**
 * Chain CompareFunctions for multi-factor sorting.
 * @param compares 
 */
export function chainedCompare<T>(...compares: CompareFunction<T>[]): CompareFunction<T> {
	return function(a: T, b: T) {
		for (const f of compares) {
			const result = f(a, b)
			if (result !== 0) {
				return result
			}
		}
		return 0
	}
}

/**
 * Test whether the given string looks like a URL according to https://www.ietf.org/rfc/rfc1738.txt
 * <p>
 * Checks if the string starts with a valid scheme followed by a colon.
 * @param value 
 * @returns 
 */
export function isURL(value: string): boolean {
	return value.match(/^[a-zA-Z0-9+.-]+:/) !== null
}
