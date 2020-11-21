import { CodegenContent, CodegenMediaType, CodegenOperation, CodegenParameters, CodegenRequestBody, CodegenResponses, CodegenSchemaPurpose, CodegenSecurityRequirement } from '@openapi-generator-plus/types'
import { OpenAPI, OpenAPIV2 } from 'openapi-types'
import { isOpenAPIV3Operation } from '../openapi-type-guards'
import { InternalCodegenState } from '../types'
import { toCodegenSecurityRequirements } from './security'
import { extractCodegenSchemaInfo, resolveReference, toUniqueName } from './utils'
import { toCodegenVendorExtensions } from './vendor-extensions'
import * as idx from '@openapi-generator-plus/indexed-type'
import _ from 'lodash'
import { toCodegenMediaType } from './media-types'
import { toCodegenParameters } from './parameters'
import { toCodegenResponses } from './responses'
import { commonTypeInfo, findAllContentMediaTypes, toCodegenContentArray } from './content'

export interface CodegenOperationContext {
	parameters?: CodegenParameters
	summary?: string
	description?: string
}

export function toCodegenOperation(path: string, method: string, operation: OpenAPI.Operation, context: CodegenOperationContext, state: InternalCodegenState): CodegenOperation {
	const name = toCodegenOperationName(path, method, operation, state)
	const responses: CodegenResponses | undefined = toCodegenResponses(operation, name, state)
	const defaultResponse = responses ? idx.find(responses, r => r.isDefault) : undefined

	let parameters: CodegenParameters | undefined
	if (operation.parameters) {
		parameters = toCodegenParameters(operation.parameters, context.parameters, name, state)
	} else if (context.parameters) {
		parameters = idx.merge(idx.create(), context.parameters)
	}

	let consumes: CodegenMediaType[] | undefined
	let bodyParam: CodegenRequestBody | undefined

	if (isOpenAPIV3Operation(operation, state.specVersion)) {
		let requestBody = operation.requestBody
		requestBody = requestBody && resolveReference(requestBody, state)

		if (requestBody) {
			/* See toCodegenParameter for rationale about scopeNames */
			const requestBodyContents = toCodegenContentArray(requestBody.content, `${name}_request`, CodegenSchemaPurpose.REQUEST_BODY, null, state)
			if (!requestBodyContents.length) {
				throw new Error(`Request body contents is empty: ${path}`)
			}

			const commonTypes = commonTypeInfo(requestBodyContents)
			if (!commonTypes) {
				throw new Error(`Cannot find common types for request body contents: ${path}`)
			}
			consumes = findAllContentMediaTypes(requestBodyContents)
			if (!consumes) {
				throw new Error(`No contents for request body: ${path}`)
			}

			bodyParam = {
				name: toUniqueName('request', parameters && idx.allKeys(parameters)),

				...commonTypes,
				...extractCodegenSchemaInfo(requestBodyContents[0]),

				description: requestBody.description,
				required: requestBody.required || false,
				schema: requestBodyContents[0],
				
				contents: requestBodyContents,
				defaultContent: requestBodyContents[0],
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
					throw new Error(`Consumes not specified for operation with body parameter: ${path}`)
				}

				const existingBodyParam = bodyParamEntry[1]
				const contents = consumes.map(mediaType => {
					const result: CodegenContent = {
						mediaType,
						schema: existingBodyParam.schema,
						...extractCodegenSchemaInfo(existingBodyParam),
					}
					return result
				})

				if (!contents.length) {
					throw new Error(`Request body contents is empty: ${path}`)
				}

				bodyParam = {
					...extractCodegenSchemaInfo(existingBodyParam),

					name: existingBodyParam.name,
					description: existingBodyParam.description,
					required: existingBodyParam.required,
					collectionFormat: existingBodyParam.collectionFormat,
					vendorExtensions: existingBodyParam.vendorExtensions,
					schema: existingBodyParam.schema,

					contents,
					defaultContent: contents[0],
					consumes,
				}
				idx.remove(parameters, bodyParamEntry[0])
			}
		}
	}

	/* Ensure parameters is undefined if empty, as generators rely on that */
	if (parameters && idx.isEmpty(parameters)) {
		parameters = undefined
	}

	let securityRequirements: CodegenSecurityRequirement[] | undefined
	if (operation.security) {
		securityRequirements = toCodegenSecurityRequirements(operation.security, state)
	} else if (state.root.security) {
		/* Use document-wide security requirements if the operation doesn't specify any */
		securityRequirements = toCodegenSecurityRequirements(state.root.security, state)
	}

	const op: CodegenOperation = {
		name,
		httpMethod: method,
		path, /* Path will later be made relative to a CodegenOperationGroup */
		fullPath: path,
		returnType: defaultResponse ? defaultResponse.type : undefined,
		returnNativeType: defaultResponse ? defaultResponse.nativeType : undefined,
		consumes,
		produces: responses ? toUniqueMediaTypes(idx.allValues(responses).reduce((collected, response) => response.produces ? [...collected, ...response.produces] : collected, [] as CodegenMediaType[])) : undefined,
		
		parameters,
		queryParams: parameters && idx.undefinedIfEmpty(idx.filter(parameters, p => p.isQueryParam)),
		pathParams: parameters && idx.undefinedIfEmpty(idx.filter(parameters, p => p.isPathParam)),
		headerParams: parameters && idx.undefinedIfEmpty(idx.filter(parameters, p => p.isHeaderParam)),
		cookieParams: parameters && idx.undefinedIfEmpty(idx.filter(parameters, p => p.isCookieParam)),
		formParams: parameters && idx.undefinedIfEmpty(idx.filter(parameters, p => p.isFormParam)),

		requestBody: bodyParam,

		securityRequirements,
		defaultResponse,
		responses,
		deprecated: operation.deprecated,
		summary: operation.summary || context.summary,
		description: operation.description || context.description,
		tags: operation.tags,
		vendorExtensions: toCodegenVendorExtensions(operation),
	}
	op.hasParamExamples = parametersHaveExamples(op.parameters)
	op.hasQueryParamExamples = parametersHaveExamples(op.queryParams)
	op.hasPathParamExamples = parametersHaveExamples(op.pathParams)
	op.hasHeaderParamExamples = parametersHaveExamples(op.headerParams)
	op.hasCookieParamExamples = parametersHaveExamples(op.cookieParams)
	op.hasRequestBodyExamples = requestBodyHasExamples(op.requestBody)
	op.hasFormParamExamples = parametersHaveExamples(op.formParams)
	op.hasResponseExamples = responsesHaveExamples(op.responses)
	return op
}

function toCodegenOperationName(path: string, method: string, operation: OpenAPI.Operation, state: InternalCodegenState) {
	if (operation.operationId) {
		return operation.operationId
	}

	return state.generator.toOperationName(path, method)
}

function parametersHaveExamples(parameters: CodegenParameters | undefined): boolean | undefined {
	if (!parameters) {
		return undefined
	}

	return !!idx.find(parameters, param => !!param.examples?.length)
}

function requestBodyHasExamples(parameter: CodegenRequestBody | undefined): boolean | undefined {
	if (!parameter || !parameter.contents) {
		return undefined
	}

	return !!parameter.contents.find(c => !!c.examples?.length)
}

function responsesHaveExamples(responses: CodegenResponses | undefined): boolean | undefined {
	if (!responses) {
		return undefined
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