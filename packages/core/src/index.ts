import { CodegenConfig, CodegenGenerator, CodegenGeneratorConstructor, CodegenState, CodegenDocument, CodegenInputDocument as CodegenInput } from '@openapi-generator-plus/types'
import { processDocument } from './process'
import { defaultGeneratorOptions } from './generators'
import SwaggerParser from '@apidevtools/swagger-parser'
import { toSpecVersion } from './utils'
import { InternalCodegenState } from './types'

/**
 * Construct a CodegenGenerator from the given constructor.
 * @param generatorConstructor 
 */
export function constructGenerator<O>(generatorConstructor: CodegenGeneratorConstructor<O>): CodegenGenerator<O> {
	return generatorConstructor(defaultGeneratorOptions())
}

export function createCodegenState<O>(config: CodegenConfig, generator: CodegenGenerator<O>): CodegenState<O> {
	return {
		generator,
		options: generator.options(config),
	}
}

export async function createCodegenInput(inputPath: string): Promise<CodegenInput> {
	const parser = new SwaggerParser()
	const root = await parser.parse(inputPath)
	return {
		root, 
		$refs: parser.$refs,
	}
}

/**
 * Return a CodegenDocument produced from the given CodegenState.
 * @param state 
 */
export function createCodegenDocument<O>(input: CodegenInput, state: CodegenState<O>): CodegenDocument {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const internalState: InternalCodegenState<O> = {
		...state,
		...input,
		usedModelFullyQualifiedNames: {},
		modelsBySchema: new Map(),
		reservedNames: {},
		models: [],
		specVersion: toSpecVersion(input.root),
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return processDocument(internalState as any as InternalCodegenState)
}
