import { OpenAPIV2, OpenAPIV3 } from 'openapi-types'

export declare namespace OpenAPIX {
	export type ResponsesObject = OpenAPIV2.ResponsesObject | OpenAPIV3.ResponsesObject
	export type Response = OpenAPIV2.Response | OpenAPIV3.ResponseObject | OpenAPIV3.ReferenceObject
	export type SchemaObject = OpenAPIV2.SchemaObject | OpenAPIV3.SchemaObject | OpenAPIV2.GeneralParameterObject
	export type ReferenceObject = OpenAPIV2.ReferenceObject | OpenAPIV3.ReferenceObject
}
