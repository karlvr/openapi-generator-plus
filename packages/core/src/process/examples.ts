import { CodegenExample, CodegenExamples, CodegenSchemaType, CodegenSchema, CodegenLogLevel, CodegenSchemaUsage, isCodegenSchemaUsage } from '@openapi-generator-plus/types'
import { OpenAPIV2, OpenAPIV3 } from 'openapi-types'
import { InternalCodegenState } from '../types'
import * as idx from '@openapi-generator-plus/indexed-type'
import { isOpenAPIV2ExampleObject, isOpenAPIV3ExampleObject } from '../openapi-type-guards'
import { toCodegenMediaType } from './media-types'
import { stringLiteralValueOptions } from '../utils'
import { debugStringify } from '@openapi-generator-plus/utils'
import { resolveReference } from './utils'

type OpenAPIV3Examples = { [name: string]: OpenAPIV3.ReferenceObject | OpenAPIV3.ExampleObject }

function canFormatExampleValueAsLiteral(schema: CodegenSchema) {
	return schema.schemaType !== CodegenSchemaType.OBJECT
}

function exampleValue(value: unknown, mediaType: string | undefined, schema: CodegenSchema, state: InternalCodegenState): Pick<CodegenExample, 'value' | 'valueLiteral' | 'valueString' | 'valuePretty'> | null {
	const valueLiteral = canFormatExampleValueAsLiteral(schema) ? state.generator.toLiteral(value, { required: true, ...schema }) : state.generator.toLiteral(null, { required: true, ...schema })
	const valueString = toCodegenExampleValueString(value, mediaType, state)
	if (valueLiteral === null || valueString === null) {
		state.log(CodegenLogLevel.WARN, `Cannot format literal for example ${debugStringify(value)} in ${debugStringify(schema)}`)
		return null
	}
	return {
		value,
		valueLiteral,
		valueString,
		valuePretty: toCodegenExampleValuePretty(value),
	}
}

function toCodegenExample(example: unknown, mediaType: string | undefined, schema: CodegenSchema, state: InternalCodegenState): CodegenExample | null {
	const value = exampleValue(example, mediaType, schema, state)
	if (value === null) {
		return null
	}
	return {
		name: null,
		summary: null,
		description: null,
		...value,
		mediaType: mediaType ? toCodegenMediaType(mediaType) : null,
	}
}

export function toCodegenExamples(apiExample: unknown | undefined, examples: OpenAPIV2.ExampleObject | OpenAPIV3Examples | undefined, mediaType: string | undefined, schema: CodegenSchema | CodegenSchemaUsage, state: InternalCodegenState): CodegenExamples | null {
	if (isCodegenSchemaUsage(schema)) {
		schema = schema.schema
	}
	
	if (apiExample) {
		const example = toCodegenExample(apiExample, mediaType, schema, state)
		if (example !== null) {
			return idx.create([
				['default', example],
			])
		} else {
			return null
		}
	}

	if (!examples) {
		return null
	}

	const result: CodegenExamples = idx.create()
	for (const mediaTypeOrName in examples) {
		const apiExample = resolveReference(examples[mediaTypeOrName], state)
		if (isOpenAPIV2ExampleObject(apiExample, state.specVersion)) {
			const example = exampleValue(apiExample, mediaTypeOrName, schema, state)
			if (example !== null) {
				idx.set(result, mediaTypeOrName, {
					name: null,
					summary: null,
					description: null,
					mediaType: toCodegenMediaType(mediaTypeOrName),
					...example,
				})
			}
		} else if (isOpenAPIV3ExampleObject(apiExample, state.specVersion)) {
			const value = apiExample.value || apiExample.externalValue // TODO handle externalValue
			const example = exampleValue(value, mediaType, schema, state)
			if (example) {
				idx.set(result, mediaTypeOrName, {
					name: mediaTypeOrName,
					mediaType: mediaType ? toCodegenMediaType(mediaType) : null,
					description: apiExample.description || null,
					summary: apiExample.summary || null,
					...example,
				})
			}
		} else {
			throw new Error(`Unsupported spec version: ${state.specVersion}`)
		}
	}

	return idx.nullIfEmpty(result)
}

function toCodegenExampleValueString(value: unknown, mediaType: string | undefined, state: InternalCodegenState) {
	if (typeof value === 'string') {
		return state.generator.toLiteral(value, stringLiteralValueOptions(state.generator))
	} else {
		// TODO we're assuming that we're transforming an object to JSON, which is appropriate is the mediaType is JSON
		const stringValue = JSON.stringify(value)
		return state.generator.toLiteral(stringValue, stringLiteralValueOptions(state.generator))
	}
}

function toCodegenExampleValuePretty(value: unknown) {
	if (typeof value === 'string') {
		return value
	} else if (value === undefined) {
		return 'undefined'
	} else if (value === null) {
		return 'null'
	} else {
		// TODO we're assuming that we're transforming an object to JSON, which is appropriate is the mediaType is JSON
		return JSON.stringify(value, undefined, 4)
	}
}
