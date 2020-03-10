import { OpenAPI } from 'openapi-types'
import { CodegenSpecVersion } from './types'
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
