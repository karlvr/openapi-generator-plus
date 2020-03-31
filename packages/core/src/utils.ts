import { OpenAPI } from 'openapi-types'
import { CodegenSpecVersion, CodegenLiteralValueOptions, CodegenState, CodegenPropertyType, CodegenTypePurpose, HttpMethods } from './types'
import { isOpenAPIV2Document, isOpenAPIV3Document } from './openapi-type-guards'

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
		throw new Error(`API specification document not recognised as Swagger or OpenAPI: ${JSON.stringify(root)}`)
	}
}

export function stringLiteralValueOptions(state: CodegenState): CodegenLiteralValueOptions {
	return {
		type: 'string', 
		propertyType: CodegenPropertyType.STRING, 
		nativeType: state.generator.toNativeType({ type: 'string', purpose: CodegenTypePurpose.PROPERTY }, state),
	}
}

export function compareHttpMethods(a: string, b: string): number {
	const aa = httpMethodToNumber(a)
	const bb = httpMethodToNumber(b)
	if (aa < bb) {
		return -1
	} else if (aa > bb) {
		return 1
	} else {
		return 0
	}
}

function httpMethodToNumber(method: string): number {
	let i = 0
	for (const aMethod in HttpMethods) {
		if (method === aMethod) {
			return i
		}
		i += 1
	}

	return i
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
