import { CodegenServer } from '@openapi-generator-plus/types'
import { OpenAPI } from 'openapi-types'
import { isOpenAPIV2Document } from '../openapi-type-guards'
import { toCodegenVendorExtensions } from './vendor-extensions'

export function toCodegenServers(root: OpenAPI.Document): CodegenServer[] | null {
	if (isOpenAPIV2Document(root)) {
		const schemes = root.schemes || ['http', 'https']
		if (root.host) {
			return schemes.map(scheme => ({
				url: `${scheme}://${root.host}${root.basePath ? root.basePath : '/'}`,
				description: null,
				vendorExtensions: null,
			}))
		} else {
			return null
		}
	} else if (root.servers) {
		return root.servers.map(server => ({
			url: server.url,
			description: server.description || null,
			vendorExtensions: toCodegenVendorExtensions(server),
		}))
	} else {
		return null
	}
}
