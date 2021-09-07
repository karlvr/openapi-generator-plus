import { CodegenServer } from '@openapi-generator-plus/types'
import { OpenAPI } from 'openapi-types'
import { isOpenAPIServersContainer, isOpenAPIV2Document } from '../openapi-type-guards'
import { OpenAPIX } from '../types/patches'
import { toCodegenVendorExtensions } from './vendor-extensions'

export function toCodegenServers(schema: OpenAPI.Document | OpenAPIX.PathItem | OpenAPI.Operation): CodegenServer[] | null {
	if (isOpenAPIV2Document(schema)) {
		const schemes = schema.schemes || ['http', 'https']
		if (schema.host) {
			return schemes.map(scheme => ({
				url: `${scheme}://${schema.host}${schema.basePath ? schema.basePath : '/'}`,
				description: null,
				vendorExtensions: null,
			}))
		} else {
			return null
		}
	} else if (isOpenAPIServersContainer(schema) && schema.servers) {
		return schema.servers.map(server => ({
			url: server.url,
			description: server.description || null,
			vendorExtensions: toCodegenVendorExtensions(server),
		}))
	} else {
		return null
	}
}
