import { CodegenConfig, CodegenGenerator, CodegenGeneratorConstructor, CodegenState, CodegenDocument } from '@openapi-generator-plus/types'
import { processDocument } from './process'
import { defaultGeneratorOptions } from './generators'
import SwaggerParser from '@apidevtools/swagger-parser'
import { OpenAPI } from 'openapi-types'
import { toSpecVersion } from './utils'
import { InternalCodegenState } from './types'

/**
 * Create the initial CodegenState by parsing the input specification.
 * @param config 
 * @param generator 
 */
export async function createCodegenState<O>(config: CodegenConfig, generator: CodegenGenerator<O>): Promise<CodegenState<O>> {
	const parser = new SwaggerParser()
	const root: OpenAPI.Document = await parser.parse(config.inputPath)

	const state: InternalCodegenState<O> = {
		parser,
		root,
		generator,
		options: generator.options(config),
		usedModelFullyQualifiedNames: {},
		inlineModels: [],
		specVersion: toSpecVersion(root),
	}

	return state
}

/**
 * Return a CodegenDocument produced from the given CodegenState.
 * @param state 
 */
export function createCodegenDocument<O>(state: CodegenState<O>): CodegenDocument {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const internalState: InternalCodegenState = state as any as InternalCodegenState

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return processDocument(internalState)
}

/**
 * Construct a CodegenGenerator from the given constructor.
 * @param generatorConstructor 
 */
export function constructGenerator<O>(generatorConstructor: CodegenGeneratorConstructor<O>): CodegenGenerator<O> {
	return generatorConstructor(defaultGeneratorOptions())
}
