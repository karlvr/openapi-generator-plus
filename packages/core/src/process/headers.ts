import { CodegenHeader, CodegenHeaders, CodegenSchemaPurpose } from '@openapi-generator-plus/types'
import { isOpenAPIV2HeaderObject, isOpenAPIV3HeaderObject } from '../openapi-type-guards'
import { InternalCodegenState } from '../types'
import { OpenAPIX } from '../types/patches'
import { toCodegenExamples } from './examples'
import { toCodegenSchema } from './schema'
import { extractCodegenSchemaLike, resolveReference } from './utils'
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
	header = resolveReference(header, state)

	if (isOpenAPIV2HeaderObject(header, state.specVersion)) {
		const schema = toCodegenSchema(header, true, name, CodegenSchemaPurpose.HEADER, null, state)
		return {
			name,
			description: null,
	
			...extractCodegenSchemaLike(schema),
	
			required: false,
			collectionFormat: header.collectionFormat || null,
	
			schema,
	
			vendorExtensions: toCodegenVendorExtensions(header),
			examples: null,
		}
	} else if (isOpenAPIV3HeaderObject(header, state.specVersion)) {
		if (!header.schema) {
			throw new Error(`Cannot resolve schema for header "${name}: ${JSON.stringify(header)}`)
		}
		
		const schema = toCodegenSchema(header.schema, header.required || false, name, CodegenSchemaPurpose.HEADER, null, state)
		const examples = toCodegenExamples(header.example, header.examples, undefined, schema, state)

		return {
			name,
	
			...extractCodegenSchemaLike(schema),
	
			description: header.description || null,
			required: header.required || false,
			collectionFormat: null,
			examples,
	
			schema,
	
			vendorExtensions: toCodegenVendorExtensions(header),
		}
	} else {
		throw 'Unsupported spec version'
	}
}
