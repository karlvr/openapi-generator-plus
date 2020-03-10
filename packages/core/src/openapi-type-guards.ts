/* eslint-disable @typescript-eslint/no-explicit-any */
import { OpenAPI, OpenAPIV2, OpenAPIV3 } from 'openapi-types'
import { OpenAPIX } from './types/patches'
import { CodegenSpecVersion } from './types'

export function isOpenAPIReferenceObject(ob: any): ob is OpenAPIV2.ReferenceObject | OpenAPIV3.ReferenceObject {
	return ((ob as any).$ref)
}

export function isOpenAPIV2ResponseObject(ob: OpenAPIX.Response, specVersion: CodegenSpecVersion): ob is OpenAPIV2.ResponseObject {
	return specVersion === CodegenSpecVersion.OpenAPIV2
}

export function isOpenAPIV3ResponseObject(ob: OpenAPIX.Response, specVersion: CodegenSpecVersion): ob is OpenAPIV3.ResponseObject {
	return specVersion === CodegenSpecVersion.OpenAPIV3
}

export function isOpenAPIV2GeneralParameterObject(ob: OpenAPI.Parameter, specVersion: CodegenSpecVersion): ob is OpenAPIV2.GeneralParameterObject {
	const anyOb = ob as any
	return (specVersion === CodegenSpecVersion.OpenAPIV2 && anyOb.type !== undefined)
}

export function isOpenAPIV2Operation(ob: OpenAPI.Operation, specVersion: CodegenSpecVersion): ob is OpenAPIV2.OperationObject {
	return specVersion === CodegenSpecVersion.OpenAPIV2
}

export function isOpenAPIV3Operation(ob: OpenAPI.Operation, specVersion: CodegenSpecVersion): ob is OpenAPIV3.OperationObject {
	return !isOpenAPIV2Operation(ob, specVersion)
}

export function isOpenAPIV2Document(ob: OpenAPI.Document): ob is OpenAPIV2.Document {
	const anyOb = ob as any
	return (anyOb.swagger !== undefined)
}

export function isOpenAPIV3Document(ob: OpenAPI.Document): ob is OpenAPIV3.Document {
	const anyOb = ob as any
	return (anyOb.openapi !== undefined)
}
