import { CodegenHeader, CodegenHeaders, CodegenSchemaPurpose } from '@openapi-generator-plus/types'
import { isOpenAPIReferenceObject, isOpenAPIV2HeaderObject, isOpenAPIV3HeaderObject } from '../openapi-type-guards'
import { InternalCodegenState } from '../types'
import { OpenAPIX } from '../types/patches'
import { toCodegenExamples } from './examples'
import { toCodegenSchemaUsage } from './schema'
import { nameFromRef, resolveReference } from './utils'
import { toCodegenVendorExtensions } from './vendor-extensions'

export function toCodegenHeaders(headers: OpenAPIX.Headers | undefined, state: InternalCodegenState): CodegenHeaders | null {
	if (headers === undefined) {
		return null
	}

	const result: CodegenHeaders = {}
	for (const key in headers) {
		const header = toCodegenHeader(key, headers[key], state)
		result[key] = header
	}
	if (Object.keys(result).length === 0) {
		return null
	}
	return result
}

function toCodegenHeader(name: string, header: OpenAPIX.Header, state: InternalCodegenState): CodegenHeader {
	const headerContextName = isOpenAPIReferenceObject(header) ? nameFromRef(header.$ref, state) : name
	header = resolveReference(header, state)

	if (isOpenAPIV2HeaderObject(header, state.specVersion)) {
		const schemaUse = toCodegenSchemaUsage(header, state, {
			required: false, 
			suggestedName: headerContextName, 
			purpose: CodegenSchemaPurpose.HEADER, 
			scope: null,
		})
		return {
			name,
			description: null,
	
			...schemaUse,
	
			required: false,
			collectionFormat: header.collectionFormat || null,
	
			vendorExtensions: toCodegenVendorExtensions(header),
			examples: null,
		}
	} else if (isOpenAPIV3HeaderObject(header, state.specVersion)) {
		const schemaUse = toCodegenSchemaUsage(header.schema || { type: 'string' }, state, {
			required: header.required || false, 
			suggestedName: name, 
			purpose: CodegenSchemaPurpose.HEADER,
			scope: null,
		})
		const examples = toCodegenExamples(header.example, header.examples, undefined, schemaUse, state)

		return {
			name,
	
			...schemaUse,
	
			description: header.description || null,
			required: header.required || false,
			collectionFormat: null,
			examples,
	
			vendorExtensions: toCodegenVendorExtensions(header),
		}
	} else {
		throw 'Unsupported spec version'
	}
}
