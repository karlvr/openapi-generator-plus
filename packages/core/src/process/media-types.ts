import { CodegenMediaType } from '@openapi-generator-plus/types'

export function toCodegenMediaType(mediaType: string): CodegenMediaType {
	const i = mediaType.indexOf(';')
	if (i === -1) {
		return {
			mediaType,
			mimeType: mediaType,
			encoding: null,
		}
	}

	let charset: string | undefined

	const matches = mediaType.match(/charset\s*=\s*([-a-zA-Z0-9_]+)/i)
	if (matches) {
		charset = matches[1]
	}
	
	return {
		mediaType,
		mimeType: mediaType.substring(0, i),
		encoding: charset || null,
	}
}

export function isMultipart(mediaType: CodegenMediaType): boolean {
	return mediaType.mimeType.startsWith('multipart/')
}
