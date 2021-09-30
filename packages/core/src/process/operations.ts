import { CodegenContent, CodegenLogLevel, CodegenMediaType, CodegenOperation, CodegenParameters, CodegenRequestBody, CodegenResponses, CodegenSchemaPurpose, CodegenSecurityRequirements, CodegenServer, CodegenVendorExtensions } from '@openapi-generator-plus/types'
import { OpenAPI, OpenAPIV2 } from 'openapi-types'
import { isOpenAPIReferenceObject, isOpenAPIV3Operation } from '../openapi-type-guards'
import { InternalCodegenState } from '../types'
import { toCodegenSecurityRequirements } from './security'
import { nameFromRef, resolveReference } from './utils'
import { mergeCodegenVendorExtensions, toCodegenVendorExtensions } from './vendor-extensions'
import * as idx from '@openapi-generator-plus/indexed-type'
import _ from 'lodash'
import { toCodegenMediaType } from './media-types'
import { toCodegenParameters } from './parameters'
import { toCodegenResponses } from './responses'
import { applyCodegenContentEncoding, findAllContentMediaTypes, toCodegenContentArray } from './content'
import { nullIfEmpty } from '@openapi-generator-plus/indexed-type'
import { toUniqueName } from './schema/naming'
import { toCodegenExternalDocs } from './external-docs'
import { toCodegenServers } from './servers'

export interface CodegenOperationContext {
	parameters?: CodegenParameters
	summary?: string
	description?: string
	vendorExtensions: CodegenVendorExtensions | null
	servers: CodegenServer[] | null
}

export function toCodegenOperation(fullPath: string, method: string, operation: OpenAPI.Operation, context: CodegenOperationContext, state: InternalCodegenState): CodegenOperation {
	const name = toCodegenOperationName(fullPath, method, operation, state)
	const responses: CodegenResponses | undefined = toCodegenResponses(operation, name, state)
	const defaultResponse = responses ? idx.find(responses, r => r.isDefault) : undefined

	let parameters: CodegenParameters | null
	if (operation.parameters) {
		parameters = toCodegenParameters(operation.parameters, context.parameters, name, state)
	} else if (context.parameters) {
		parameters = idx.merge(idx.create(), context.parameters)
	} else {
		parameters = null
	}

	let consumes: CodegenMediaType[] | undefined
	let bodyParam: CodegenRequestBody | undefined

	if (isOpenAPIV3Operation(operation, state.specVersion)) {
		let requestBody = operation.requestBody

		if (requestBody) {
			const requestBodyContextName = isOpenAPIReferenceObject(requestBody) ? nameFromRef(requestBody.$ref, state) : `${name}_request`
			requestBody = resolveReference(requestBody, state)

			/* See toCodegenParameter for rationale about scopeNames */
			const requestBodyContents = toCodegenContentArray(requestBody.content, requestBody.required || false, requestBodyContextName, CodegenSchemaPurpose.REQUEST_BODY, null, state)
			if (!requestBodyContents.length) {
				throw new Error(`Request body contents is empty: ${fullPath}`)
			}

			consumes = findAllContentMediaTypes(requestBodyContents)
			if (!consumes) {
				throw new Error(`No contents for request body: ${fullPath}`)
			}

			const defaultContent = requestBodyContents[0]
			bodyParam = {
				name: toUniqueName('request', undefined, parameters, state),
				serializedName: 'request', /* This doesn't actually have a serialized name as we created it */

				required: defaultContent.required,
				schema: defaultContent.schema,
				nativeType: defaultContent.nativeType,
				examples: defaultContent.examples,
				defaultValue: null,

				nullable: false,
				readOnly: false,
				writeOnly: false,
				deprecated: false,

				description: requestBody.description || null,
				collectionFormat: null,
				
				contents: requestBodyContents,
				defaultContent,
				consumes,

				vendorExtensions: toCodegenVendorExtensions(requestBody),
			}
		}
	} else {
		consumes = toConsumeMediaTypes(operation as OpenAPIV2.OperationObject, state)

		/* Apply special body param properties */
		if (parameters) {
			const bodyParamEntry = idx.findEntry(parameters, p => p.in === 'body')
			if (bodyParamEntry) {
				if (!consumes) {
					throw new Error(`Consumes not specified for operation with body parameter: ${fullPath}`)
				}

				const existingBodyParam = bodyParamEntry[1]
				const contents = consumes.map(mediaType => {
					const result: CodegenContent = {
						mediaType,
						encoding: null,
						examples: null,
						required: existingBodyParam.required,
						schema: existingBodyParam.schema,
						nativeType: existingBodyParam.nativeType,
					}
					applyCodegenContentEncoding(result, undefined, state)
					return result
				})

				if (!contents.length) {
					throw new Error(`Request body contents is empty: ${fullPath}`)
				}

				bodyParam = {
					name: existingBodyParam.name,
					serializedName: existingBodyParam.serializedName,
					description: existingBodyParam.description,
					collectionFormat: existingBodyParam.collectionFormat,
					vendorExtensions: existingBodyParam.vendorExtensions,

					nullable: existingBodyParam.nullable,
					readOnly: existingBodyParam.readOnly,
					writeOnly: existingBodyParam.writeOnly,
					deprecated: existingBodyParam.deprecated,

					contents,
					defaultContent: contents[0],
					consumes,

					schema: existingBodyParam.schema,
					nativeType: existingBodyParam.nativeType,
					defaultValue: existingBodyParam.defaultValue,
					examples: existingBodyParam.examples,
					required: existingBodyParam.required,
				}
				idx.remove(parameters, bodyParamEntry[0])
			}
		}
	}

	/* Ensure parameters is null if empty, as generators rely on that */
	parameters = nullIfEmpty(parameters)

	let securityRequirements: CodegenSecurityRequirements | undefined
	if (operation.security) {
		securityRequirements = toCodegenSecurityRequirements(operation.security, state)
	} else if (state.root.security) {
		/* Use document-wide security requirements if the operation doesn't specify any */
		securityRequirements = toCodegenSecurityRequirements(state.root.security, state)
	}

	const queryParams = parameters ? idx.nullIfEmpty(idx.filter(parameters, p => p.isQueryParam)) : null
	const pathParams = parameters ? idx.nullIfEmpty(idx.filter(parameters, p => p.isPathParam)) : null
	const headerParams = parameters ? idx.nullIfEmpty(idx.filter(parameters, p => p.isHeaderParam)) : null
	const cookieParams = parameters ? idx.nullIfEmpty(idx.filter(parameters, p => p.isCookieParam)) : null
	const formParams = parameters ? idx.nullIfEmpty(idx.filter(parameters, p => p.isFormParam)) : null

	/* Validate path params */
	if (pathParams) {
		for (const param of idx.allValues(pathParams)) {
			if (fullPath.indexOf(`{${param.serializedName}}`) === -1) {
				state.log(CodegenLogLevel.WARN, `${fullPath} has a path parameter "${param.serializedName}" that is not contained in the path.`)
			}
		}
	}

	const op: CodegenOperation = {
		name,
		httpMethod: method,
		path: fullPath, /* Path will later be made relative to a CodegenOperationGroup */
		fullPath,
		returnNativeType: defaultResponse && defaultResponse.defaultContent && defaultResponse.defaultContent.nativeType || null,
		consumes: consumes || null,
		produces: responses ? toUniqueMediaTypes(idx.allValues(responses).reduce((collected, response) => response.produces ? [...collected, ...response.produces] : collected, [] as CodegenMediaType[])) : null,
		
		parameters,
		queryParams,
		pathParams,
		headerParams,
		cookieParams,
		formParams,

		requestBody: bodyParam || null,

		securityRequirements: securityRequirements || null,
		defaultResponse: defaultResponse || null,
		responses: responses || null,
		deprecated: !!operation.deprecated,
		summary: operation.summary || context.summary || null,
		description: operation.description || context.description || null,
		tags: operation.tags || null,
		vendorExtensions: mergeCodegenVendorExtensions(context.vendorExtensions, toCodegenVendorExtensions(operation)),
		externalDocs: toCodegenExternalDocs(operation),
		servers: toCodegenServers(operation) || context.servers,

		hasParamExamples: parametersHaveExamples(parameters || null),
		hasQueryParamExamples: parametersHaveExamples(queryParams),
		hasPathParamExamples: parametersHaveExamples(pathParams),
		hasHeaderParamExamples: parametersHaveExamples(headerParams),
		hasCookieParamExamples: parametersHaveExamples(cookieParams),
		hasRequestBodyExamples: requestBodyHasExamples(bodyParam || null),
		hasFormParamExamples: parametersHaveExamples(formParams),
		hasResponseExamples: responsesHaveExamples(responses || null),
	}
	return op
}

function toCodegenOperationName(path: string, method: string, operation: OpenAPI.Operation, state: InternalCodegenState) {
	if (operation.operationId) {
		return state.generator.toIdentifier(operation.operationId)
	}

	return state.generator.toOperationName(path, method)
}

function parametersHaveExamples(parameters: CodegenParameters | null): boolean {
	if (!parameters) {
		return false
	}

	return !!idx.find(parameters, param => !!param.examples?.length)
}

function requestBodyHasExamples(parameter: CodegenRequestBody | null): boolean {
	if (!parameter || !parameter.contents) {
		return false
	}

	return !!parameter.contents.find(c => !!c.examples?.length)
}

function responsesHaveExamples(responses: CodegenResponses | null): boolean {
	if (!responses) {
		return false
	}

	return !!idx.findEntry(responses, response => response.contents && response.contents.find(c => !!c.examples?.length))
}

function toUniqueMediaTypes(mediaTypes: CodegenMediaType[]): CodegenMediaType[] {
	return _.uniqWith(mediaTypes, mediaTypeEquals)
}

function mediaTypeEquals(a: CodegenMediaType, b: CodegenMediaType): boolean {
	return a.mediaType === b.mediaType
}

function toConsumeMediaTypes(op: OpenAPIV2.OperationObject, state: InternalCodegenState): CodegenMediaType[] | undefined {
	if (op.consumes) {
		return op.consumes?.map(mediaType => toCodegenMediaType(mediaType))
	} else {
		const doc = state.root as OpenAPIV2.Document
		if (doc.consumes) {
			return doc.consumes.map(mediaType => toCodegenMediaType(mediaType))
		} else {
			return undefined
		}
	}
}
