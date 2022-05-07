import { CodegenContent, CodegenLogLevel, CodegenMediaType, CodegenResponse, CodegenResponses, CodegenSchemaPurpose } from '@openapi-generator-plus/types'
import { OpenAPI, OpenAPIV2, OpenAPIV3_1 } from 'openapi-types'
import { InternalCodegenState } from '../types'
import { OpenAPIX } from '../types/patches'
import { nameFromRef, resolveReference } from './utils'
import * as idx from '@openapi-generator-plus/indexed-type'
import { isOpenAPIReferenceObject, isOpenAPIV2ResponseObject, isOpenAPIV3ResponseObject } from '../openapi-type-guards'
import { toCodegenExamples } from './examples'
import { applyCodegenContentEncoding, findAllContentMediaTypes, toCodegenContentArray } from './content'
import { toCodegenHeaders } from './headers'
import { toCodegenVendorExtensions } from './vendor-extensions'
import { toCodegenMediaType } from './media-types'
import { toCodegenSchemaUsage } from './schema'
import { debugStringify } from '@openapi-generator-plus/utils'

export function toCodegenResponses(operation: OpenAPI.Operation, scopeName: string, state: InternalCodegenState): CodegenResponses | undefined {
	const responses = operation.responses
	if (!responses) {
		return undefined
	}

	const result: CodegenResponses = idx.create()

	let bestCode: number | undefined
	let bestResponse: CodegenResponse | undefined

	for (const responseCodeString in responses) {
		const responseCode = responseCodeString === 'default' ? 0 : parseInt(responseCodeString, 10)
		const response = toCodegenResponse(operation, responseCode, responses[responseCodeString]!, false, scopeName, state)

		idx.set(result, `${responseCode}`, response)

		/* See DefaultCodegen.findMethodResponse */
		if (responseCode === 0 || Math.floor(responseCode / 100) === 2) {
			if (bestCode === undefined || responseCode < bestCode) {
				bestCode = responseCode
				bestResponse = response
			}
		}
	}

	if (bestCode !== undefined && bestResponse) {
		bestResponse.isDefault = true
	}

	return idx.undefinedIfEmpty(result)
}

function toCodegenResponse(operation: OpenAPI.Operation, code: number, response: OpenAPIX.Response, isDefault: boolean, scopeName: string, state: InternalCodegenState): CodegenResponse {
	const responseContextName = isOpenAPIReferenceObject(response) ? nameFromRef(response.$ref, state) : `${scopeName}_${code}_response`

	/* We allow preserving the original description if the usage is by reference */
	const description = isOpenAPIReferenceObject(response) ? (response as OpenAPIV3_1.ReferenceObject).description : undefined

	response = resolveReference(response, state)

	if (code === 0) {
		code = 200
	}
	
	let contents: CodegenContent[] | undefined

	if (isOpenAPIV2ResponseObject(response, state.specVersion)) {
		if (response.schema) {
			/* We don't pass scopeNames to toCodegenProperty; see toCodegenParameter for rationale */
			const schemaUse = toCodegenSchemaUsage(response.schema, state, {
				required: true,
				suggestedName: responseContextName,
				purpose: CodegenSchemaPurpose.RESPONSE,
				suggestedScope: null,
			})
			const examples = toCodegenExamples(undefined, response.examples, undefined, schemaUse, state)

			const mediaTypes = toProduceMediaTypes(operation as OpenAPIV2.OperationObject, state)
			if (!mediaTypes) {
				state.log(CodegenLogLevel.WARN, `Response for operation ${scopeName} has a schema but operation doesn't specify any produces media types`)
			}

			contents = mediaTypes ? mediaTypes.map(mediaType => {
				const result: CodegenContent = {
					mediaType,
					...schemaUse,
					examples: examples && examples[mediaType.mediaType] ? { default: examples[mediaType.mediaType] } : null,
					encoding: null,
				}
				applyCodegenContentEncoding(result, undefined, state)
				return result
			}) : undefined
		}
	} else if (isOpenAPIV3ResponseObject(response, state.specVersion)) {
		if (response.content) {
			/* We don't pass scopeNames to toCodegenProperty; see toCodegenParameter for rationale */
			contents = toCodegenContentArray(response.content, true, responseContextName, CodegenSchemaPurpose.RESPONSE, null, state)
		}
	} else {
		throw new Error(`Unsupported response: ${debugStringify(response)}`)
	}

	const produces = findAllContentMediaTypes(contents)
	const defaultContent = (contents && contents.length) ? contents[0] : null

	return {
		code,
		description: description || response.description,
		isDefault,
		contents: contents && contents.length ? contents : null,
		defaultContent,
		produces: produces || null,
		headers: toCodegenHeaders(response.headers, state),
		vendorExtensions: toCodegenVendorExtensions(response),
	}
}

function toProduceMediaTypes(op: OpenAPIV2.OperationObject, state: InternalCodegenState): CodegenMediaType[] | undefined {
	if (op.produces) {
		return op.produces.map(mediaType => toCodegenMediaType(mediaType))
	} else {
		const doc = state.root as OpenAPIV2.Document
		if (doc.produces) {
			return doc.produces.map(mediaType => toCodegenMediaType(mediaType))
		} else {
			return undefined
		}
	}
}
