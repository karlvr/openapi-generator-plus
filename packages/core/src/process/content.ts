import { CodegenContent, CodegenExamples, CodegenMediaType, CodegenSchemaPurpose, CodegenScope } from '@openapi-generator-plus/types'
import { OpenAPIV3 } from 'openapi-types'
import { InternalCodegenState } from '../types'
import { toCodegenExamples } from './examples'
import { toCodegenMediaType } from './media-types'
import { toCodegenSchemaUsage } from './schema'

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

export function findAllContentMediaTypes(contents: CodegenContent[] | undefined): CodegenMediaType[] | undefined {
	if (!contents || !contents.length) {
		return undefined
	}

	return contents.reduce((existing, content) => content.mediaType ? [...existing, content.mediaType] : existing, [] as CodegenMediaType[])
}

