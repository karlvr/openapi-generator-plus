import { CodegenOperation, HttpMethods } from '@openapi-generator-plus/types'
import { OpenAPI, OpenAPIV2, OpenAPIV3 } from 'openapi-types'
import { isOpenAPIV3PathItemObject } from '../openapi-type-guards'
import { InternalCodegenState } from '../types'
import { CodegenOperationContext, toCodegenOperation } from './operations'
import { toCodegenParameters } from './parameters'
import { toCodegenServers } from './servers'
import { toCodegenVendorExtensions } from './vendor-extensions'

export function toCodegenOperations(path: string, pathItem: OpenAPIV2.PathItemObject | OpenAPIV3.PathItemObject, state: InternalCodegenState): CodegenOperation[] {
	const operations: CodegenOperation[] = []

	function createCodegenOperation(path: string, method: string, operation: OpenAPI.Operation | undefined, context: CodegenOperationContext) {
		if (!operation) {
			return
		}
	
		const op = toCodegenOperation(path, method, operation, context, state)
		operations.push(op)
	}

	const operationContext: CodegenOperationContext = {
		parameters: pathItem.parameters ? toCodegenParameters(pathItem.parameters, undefined, path, state) || undefined : undefined,
		summary: isOpenAPIV3PathItemObject(pathItem, state.specVersion) ? pathItem.summary : undefined,
		description: isOpenAPIV3PathItemObject(pathItem, state.specVersion) ? pathItem.description : undefined,
		vendorExtensions: toCodegenVendorExtensions(pathItem),
		servers: toCodegenServers(pathItem),
	}
		
	createCodegenOperation(path, HttpMethods.GET, pathItem.get, operationContext)
	createCodegenOperation(path, HttpMethods.PUT, pathItem.put, operationContext)
	createCodegenOperation(path, HttpMethods.POST, pathItem.post, operationContext)
	createCodegenOperation(path, HttpMethods.DELETE, pathItem.delete, operationContext)
	createCodegenOperation(path, HttpMethods.OPTIONS, pathItem.options, operationContext)
	createCodegenOperation(path, HttpMethods.HEAD, pathItem.head, operationContext)
	createCodegenOperation(path, HttpMethods.PATCH, pathItem.patch, operationContext)
	if (isOpenAPIV3PathItemObject(pathItem, state.specVersion)) {
		createCodegenOperation(path, HttpMethods.TRACE, pathItem.trace, operationContext)
	}

	return operations
}
