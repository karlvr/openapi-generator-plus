import { CodegenServer } from '@openapi-generator-plus/types'
import { OpenAPI } from 'openapi-types'
import { isOpenAPIV2Document } from '../openapi-type-guards'
import { toCodegenVendorExtensions } from './vendor-extensions'

export function toCodegenServers(root: OpenAPI.Document): CodegenServer[] | undefined {
	if (isOpenAPIV2Document(root)) {
		if (root.schemes && root.host) {
			return root.schemes.map(scheme => ({
				url: `${scheme}://${root.host}${root.basePath ? root.basePath : '/'}`,
			}))
		} else {
			return undefined
		}
	} else if (root.servers) {
		return root.servers.map(server => ({
			url: server.url,
			description: server.description,
			vendorExtensions: toCodegenVendorExtensions(server),
		}))
	} else {
		return undefined
	}
}
