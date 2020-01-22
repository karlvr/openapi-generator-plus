import { OpenAPI, OpenAPIV2, OpenAPIV3 } from 'openapi-types'

export namespace OpenAPIX {
	export type ResponsesObject = OpenAPIV2.ResponsesObject | OpenAPIV3.ResponsesObject
	export type Response = OpenAPIV2.Response | OpenAPIV3.ResponseObject | OpenAPIV3.ReferenceObject
}
