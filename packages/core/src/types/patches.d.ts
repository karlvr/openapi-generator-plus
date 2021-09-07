import { OpenAPIV2, OpenAPIV3 } from 'openapi-types'

export declare namespace OpenAPIX {
	export type ResponsesObject = OpenAPIV2.ResponsesObject | OpenAPIV3.ResponsesObject
	export type Response = OpenAPIV2.Response | OpenAPIV3.ResponseObject | OpenAPIV3.ReferenceObject
	export type SchemaObject = OpenAPIV2.SchemaObject | OpenAPIV3.SchemaObject | OpenAPIV2.GeneralParameterObject
	export type ReferenceObject = OpenAPIV2.ReferenceObject | OpenAPIV3.ReferenceObject
	export type Parameters = OpenAPIV2.Parameters | (OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject)[]
	export type Headers = OpenAPIV2.HeadersObject | {
		[header: string]: OpenAPIV3.ReferenceObject | OpenAPIV3.HeaderObject
	}
	export type Header = OpenAPIV2.HeaderObject | OpenAPIV3.HeaderObject | OpenAPIV3.ReferenceObject
	export type PathItem = OpenAPIV2.PathItemObject | OpenAPIV3.PathItemObject
	export interface ServersContainer {
		servers?: OpenAPIV3.ServerObject[]
	}
}
