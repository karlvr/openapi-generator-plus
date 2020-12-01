import { CodegenContent, CodegenExamples, CodegenMediaType, CodegenSchemaPurpose, CodegenScope, CodegenTypeInfo } from '@openapi-generator-plus/types'
import { OpenAPIV3 } from 'openapi-types'
import { InternalCodegenState } from '../types'
import { toCodegenExamples } from './examples'
import { toCodegenMediaType } from './media-types'
import { toCodegenSchemaUsage } from './schema'
import { extractCodegenTypeInfo } from './utils'

export function toCodegenContentArray(content: { [media: string]: OpenAPIV3.MediaTypeObject }, required: boolean, suggestedSchemaName: string, purpose: CodegenSchemaPurpose, scope: CodegenScope | null, state: InternalCodegenState): CodegenContent[] {
	const result: CodegenContent[] = []
	for (const mediaType in content) {
		const mediaTypeContent = content[mediaType]

		if (!mediaTypeContent.schema) {
			throw new Error('Media type content without a schema')
		}
		const schemaUse = toCodegenSchemaUsage(mediaTypeContent.schema, required, suggestedSchemaName, purpose, scope, state)

		const examples: CodegenExamples | null = toCodegenExamples(mediaTypeContent.example, mediaTypeContent.examples, mediaType, schemaUse, state)

		const item: CodegenContent = {
			mediaType: toCodegenMediaType(mediaType),
			examples,
			...schemaUse,
		}
		result.push(item)
	}

	return result
}

/**
 * Finds the common property type info from the array of CodegenContent, or returns `undefined` if there
 * is no common property type info.
 */
export function commonTypeInfo(contents: CodegenContent[] | undefined): CodegenTypeInfo | undefined {
	if (!contents || !contents.length) {
		return undefined
	}

	let result: CodegenTypeInfo | undefined
	
	for (const content of contents) {
		if (!result) {
			result = extractCodegenTypeInfo(content)
		} else {
			if (content.type !== result.type) {
				return undefined
			}
			if (content.format !== result.format) {
				return undefined
			}
			if (content.nativeType && result.nativeType) {
				if (!content.nativeType.equals(result.nativeType)) {
					return undefined
				}
			} else if (content.nativeType !== result.nativeType) {
				return undefined
			}
		}
	}
	return result
}

export function findAllContentMediaTypes(contents: CodegenContent[] | undefined): CodegenMediaType[] | undefined {
	if (!contents || !contents.length) {
		return undefined
	}

	return contents.reduce((existing, content) => content.mediaType ? [...existing, content.mediaType] : existing, [] as CodegenMediaType[])
}

