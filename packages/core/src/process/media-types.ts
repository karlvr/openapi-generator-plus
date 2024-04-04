import { CodegenMediaType } from '@openapi-generator-plus/types'

export function toCodegenMediaType(mediaType: string): CodegenMediaType {
	const i = mediaType.indexOf(';')
	if (i === -1) {
		return {
			mediaType,
			mimeType: mediaType,
			encoding: null,
			wildcard: mediaType.indexOf('*') !== -1,
		}
	}

	let charset: string | undefined

	const matches = mediaType.match(/charset\s*=\s*([-a-zA-Z0-9_]+)/i)
	if (matches) {
		charset = matches[1]
	}
	
	const mimeType = mediaType.substring(0, i)
	return {
		mediaType,
		mimeType,
		encoding: charset || null,
		wildcard: mimeType.indexOf('*') !== -1,
	}
}

export function isMultipart(mediaType: CodegenMediaType): boolean {
	return mediaType.mimeType.startsWith('multipart/')
}
