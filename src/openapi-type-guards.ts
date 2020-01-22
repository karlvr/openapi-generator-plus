import { OpenAPI, OpenAPIV2, OpenAPIV3 } from 'openapi-types'
import { OpenAPIX } from './types/patches'

export function isOpenAPIV2ResponseObject(ob: OpenAPIX.Response): ob is OpenAPIV2.ResponseObject {
	const anyOb = ob as any
	return (anyOb.description && !anyOb.content && !anyOb.links)
}

export function isOpenAPIVReferenceObject(ob: any): ob is OpenAPIV2.ReferenceObject | OpenAPIV3.ReferenceObject {
	return ((ob as any).$ref)
}

export function isOpenAPIV3ResponseObject(ob: OpenAPIX.Response): ob is OpenAPIV3.ResponseObject {
	const anyOb = ob as any
	return (anyOb.description && !anyOb.examples && !anyOb.schema)
}

export function isOpenAPIV2GeneralParameterObject(ob: OpenAPI.Parameter): ob is OpenAPIV2.GeneralParameterObject {
	const anyOb = ob as any
	return (anyOb.type !== undefined)
}

export function isOpenAPIV2Operation(ob: OpenAPI.Operation): ob is OpenAPIV2.OperationObject {
	const anyOb = ob as OpenAPIV2.OperationObject & OpenAPIV3.OperationObject
	if (anyOb.consumes || anyOb.produces) {
		return true
	}
	if (anyOb.requestBody || anyOb.callbacks || anyOb.servers) {
		return false
	}
	return true
}
