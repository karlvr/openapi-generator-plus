/* eslint-disable @typescript-eslint/no-explicit-any */
import { OpenAPI, OpenAPIV2, OpenAPIV3 } from 'openapi-types'
import { OpenAPIX } from './types/patches'
import { CodegenSpecVersion } from './types'

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function isOpenAPIReferenceObject(ob: any): ob is OpenAPIV2.ReferenceObject | OpenAPIV3.ReferenceObject {
	return !!((ob as any).$ref)
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

export function isOpenAPIV2HeaderObject(ob: OpenAPIX.Header, specVersion: CodegenSpecVersion): ob is OpenAPIV2.HeaderObject {
	return specVersion === CodegenSpecVersion.OpenAPIV2
}

export function isOpenAPIV3HeaderObject(ob: OpenAPIX.Header, specVersion: CodegenSpecVersion): ob is OpenAPIV3.HeaderObject {
	return specVersion === CodegenSpecVersion.OpenAPIV3
}

export function isOpenAPIV2Operation(ob: OpenAPI.Operation, specVersion: CodegenSpecVersion): ob is OpenAPIV2.OperationObject {
	return specVersion === CodegenSpecVersion.OpenAPIV2
}

export function isOpenAPIV3Operation(ob: OpenAPI.Operation, specVersion: CodegenSpecVersion): ob is OpenAPIV3.OperationObject {
	return specVersion === CodegenSpecVersion.OpenAPIV3
}

export function isOpenAPIV2Document(ob: OpenAPI.Document | unknown): ob is OpenAPIV2.Document {
	const anyOb = ob as any
	return typeof anyOb.swagger === 'string'
}

export function isOpenAPIV3Document(ob: OpenAPI.Document | unknown): ob is OpenAPIV3.Document {
	const anyOb = ob as any
	return typeof anyOb.openapi === 'string'
}

export function isOpenAPIV2SecurityScheme(ob: OpenAPIV2.SecuritySchemeObject | OpenAPIV3.SecuritySchemeObject, specVersion: CodegenSpecVersion): ob is OpenAPIV2.SecuritySchemeObject {
	return specVersion === CodegenSpecVersion.OpenAPIV2
}

export function isOpenAPIV3SecurityScheme(ob: OpenAPIV2.SecuritySchemeObject | OpenAPIV3.SecuritySchemeObject, specVersion: CodegenSpecVersion): ob is OpenAPIV3.SecuritySchemeObject {
	return specVersion === CodegenSpecVersion.OpenAPIV3
}

export function isOpenAPIV2ExampleObject(ob: OpenAPIV2.ExampleObject | OpenAPIV3.ExampleObject, specVersion: CodegenSpecVersion): ob is OpenAPIV2.ExampleObject {
	return specVersion === CodegenSpecVersion.OpenAPIV2
}

export function isOpenAPIV3ExampleObject(ob: OpenAPIV2.ExampleObject | OpenAPIV3.ExampleObject, specVersion: CodegenSpecVersion): ob is OpenAPIV3.ExampleObject {
	return specVersion === CodegenSpecVersion.OpenAPIV3
}

export function isOpenAPIv3SchemaObject(ob: OpenAPIV2.Schema | OpenAPIV3.SchemaObject | OpenAPIV2.GeneralParameterObject, specVersion: CodegenSpecVersion): ob is OpenAPIV3.SchemaObject {
	return specVersion === CodegenSpecVersion.OpenAPIV3
}

export function isOpenAPIV2PathItemObject(ob: OpenAPIV2.PathItemObject | OpenAPIV3.PathItemObject, specVersion: CodegenSpecVersion): ob is OpenAPIV2.PathItemObject {
	return specVersion === CodegenSpecVersion.OpenAPIV2
}

export function isOpenAPIV3PathItemObject(ob: OpenAPIV2.PathItemObject | OpenAPIV3.PathItemObject, specVersion: CodegenSpecVersion): ob is OpenAPIV3.PathItemObject {
	return specVersion === CodegenSpecVersion.OpenAPIV3
}

export function isOpenAPIServersContainer(ob: unknown): ob is OpenAPIX.ServersContainer {
	const servers = (ob as any).servers
	return typeof servers === 'object' &&
		Array.isArray(servers) &&
		(servers.length === 0 || (typeof servers[0] === 'object' && typeof servers[0].url === 'string'))
}
