import { CodegenExample, CodegenExamples, CodegenSchemaUse, CodegenSchemaType, CodegenTypeInfo } from '@openapi-generator-plus/types'
import { OpenAPIV2, OpenAPIV3 } from 'openapi-types'
import { InternalCodegenState } from '../types'
import * as idx from '@openapi-generator-plus/indexed-type'
import { isOpenAPIV2ExampleObject, isOpenAPIV3ExampleObject } from '../openapi-type-guards'
import { toCodegenMediaType } from './media-types'
import { extractCodegenTypeInfo } from './utils'
import { stringLiteralValueOptions } from '../utils'

type OpenAPIV3Examples = { [name: string]: OpenAPIV3.ReferenceObject | OpenAPIV3.ExampleObject }

function canFormatExampleValueAsLiteral(schema: CodegenTypeInfo) {
	return schema.schemaType !== CodegenSchemaType.ARRAY && schema.schemaType !== CodegenSchemaType.OBJECT && schema.schemaType !== CodegenSchemaType.FILE
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function exampleValue(value: any, mediaType: string | undefined, schema: CodegenSchemaUse, state: InternalCodegenState): Pick<CodegenExample, 'value' | 'valueLiteral' | 'valueString' | 'valuePretty'> {
	return {
		value,
		valueLiteral: canFormatExampleValueAsLiteral(schema) ? state.generator.toLiteral(value, schema) : value,
		valueString: toCodegenExampleValueString(value, mediaType, state),
		valuePretty: toCodegenExampleValuePretty(value),
		...extractCodegenTypeInfo(schema),
	}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
function toCodegenExample(example: any, mediaType: string | undefined, schema: CodegenSchemaUse, state: InternalCodegenState): CodegenExample {
	return {
		name: null,
		summary: null,
		description: null,
		...exampleValue(example, mediaType, schema, state),
		mediaType: mediaType ? toCodegenMediaType(mediaType) : null,
		...extractCodegenTypeInfo(schema),
	}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toCodegenExamples(example: any | undefined, examples: OpenAPIV2.ExampleObject | OpenAPIV3Examples | undefined, mediaType: string | undefined, schema: CodegenSchemaUse, state: InternalCodegenState): CodegenExamples | null {
	if (example) {
		return idx.create([
			['default', toCodegenExample(example, mediaType, schema, state)],
		])
	}

	if (!examples) {
		return null
	}

	const result: CodegenExamples = idx.create()
	for (const mediaTypeOrName in examples) {
		const example = examples[mediaTypeOrName]
		if (isOpenAPIV2ExampleObject(example, state.specVersion)) {
			idx.set(result, mediaTypeOrName, {
				name: null,
				summary: null,
				description: null,
				mediaType: toCodegenMediaType(mediaTypeOrName),
				...exampleValue(example, mediaTypeOrName, schema, state),
				...extractCodegenTypeInfo(schema),
			})
		} else if (isOpenAPIV3ExampleObject(example, state.specVersion)) {
			const value = example.value || example.externalValue // TODO handle externalValue
			idx.set(result, mediaTypeOrName, {
				name: mediaTypeOrName,
				mediaType: mediaType ? toCodegenMediaType(mediaType) : null,
				description: example.description || null,
				summary: example.summary || null,
				...exampleValue(value, mediaType, schema, state),
				...extractCodegenTypeInfo(schema),
			})
		} else {
			throw new Error(`Unsupported spec version: ${state.specVersion}`)
		}
	}

	return idx.nullIfEmpty(result)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toCodegenExampleValueString(value: any, mediaType: string | undefined, state: InternalCodegenState) {
	if (typeof value === 'string') {
		return state.generator.toLiteral(value, stringLiteralValueOptions(state.generator))
	} else {
		// TODO we're assuming that we're transforming an object to JSON, which is appropriate is the mediaType is JSON
		const stringValue = JSON.stringify(value)
		return state.generator.toLiteral(stringValue, stringLiteralValueOptions(state.generator))
	}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toCodegenExampleValuePretty(value: any) {
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
