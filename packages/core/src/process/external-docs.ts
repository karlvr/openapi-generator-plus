import { OpenAPI } from 'openapi-types'
import { CodegenExternalDocs } from '../../../types/dist'
import { OpenAPIX } from '../types/patches'

export function toCodegenExternalDocs(root: OpenAPI.Document | OpenAPIX.SchemaObject | OpenAPI.Operation): CodegenExternalDocs | null {
	if (!root.externalDocs) {
		return null
	}

	return {
		description: root.externalDocs.description || null,
		url: root.externalDocs.url,
	}
}
