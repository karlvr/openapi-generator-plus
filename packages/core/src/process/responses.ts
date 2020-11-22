import { CodegenContent, CodegenMediaType, CodegenResponse, CodegenResponses, CodegenSchemaPurpose } from '@openapi-generator-plus/types'
import { OpenAPI, OpenAPIV2 } from 'openapi-types'
import { InternalCodegenState } from '../types'
import { OpenAPIX } from '../types/patches'
import { extractCodegenSchemaLike, resolveReference } from './utils'
import * as idx from '@openapi-generator-plus/indexed-type'
import { isOpenAPIV2ResponseObject, isOpenAPIV3ResponseObject } from '../openapi-type-guards'
import { toCodegenExamples } from './examples'
import { commonTypeInfo, findAllContentMediaTypes, toCodegenContentArray } from './content'
import { toCodegenHeaders } from './headers'
import { toCodegenVendorExtensions } from './vendor-extensions'
import { toCodegenMediaType } from './media-types'
import { toCodegenSchema } from './schema'

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
		const response = toCodegenResponse(operation, responseCode, responses[responseCodeString], false, scopeName, state)

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
	response = resolveReference(response, state)

	if (code === 0) {
		code = 200
	}
	
	let contents: CodegenContent[] | undefined

	if (isOpenAPIV2ResponseObject(response, state.specVersion)) {
		if (response.schema) {
			/* We don't pass scopeNames to toCodegenProperty; see toCodegenParameter for rationale */
			const schema = toCodegenSchema(response.schema, true, `${scopeName}_${code}_response`, CodegenSchemaPurpose.RESPONSE, null, state)
			const examples = toCodegenExamples(undefined, response.examples, undefined, schema, state)

			const mediaTypes = toProduceMediaTypes(operation as OpenAPIV2.OperationObject, state)
			contents = mediaTypes ? mediaTypes.map(mediaType => {
				const result: CodegenContent = {
					mediaType,
					schema,
					examples: examples && examples[mediaType.mediaType] ? { default: examples[mediaType.mediaType] } : null,
					...extractCodegenSchemaLike(schema),
				}
				return result
			}) : undefined
		}
	} else if (isOpenAPIV3ResponseObject(response, state.specVersion)) {
		if (response.content) {
			/* We don't pass scopeNames to toCodegenProperty; see toCodegenParameter for rationale */
			contents = toCodegenContentArray(response.content, `${scopeName}_${code}_response`, CodegenSchemaPurpose.RESPONSE, null, state)
		}
	} else {
		throw new Error(`Unsupported response: ${JSON.stringify(response)}`)
	}

	/* Determine if there's a common type and nativeType */
	const commonTypes = commonTypeInfo(contents)
	const produces = findAllContentMediaTypes(contents)

	const defaultContent = (contents && contents.length) ? contents[0] : null

	return {
		code,
		description: response.description,
		isDefault,
		...commonTypes,
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
