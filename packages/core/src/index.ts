import { CodegenConfig, CodegenGenerator, CodegenGeneratorConstructor, CodegenState, CodegenDocument, CodegenInputDocument as CodegenInput, CodegenGeneratorContext } from '@openapi-generator-plus/types'
import { processDocument } from './process'
import SwaggerParser from '@openapi-generator-plus/swagger-parser'
import { toSpecVersion } from './utils'
import { InternalCodegenState } from './types'
import * as idx from '@openapi-generator-plus/indexed-type'
import { OpenAPI } from 'openapi-types'
import { defaultLog } from './logging'
export { createGeneratorContext } from './generators'

export * as idx from '@openapi-generator-plus/indexed-type'

/**
 * Construct a CodegenGenerator from the given constructor.
 * @param generatorConstructor 
 */
export function constructGenerator(config: CodegenConfig, context: CodegenGeneratorContext, generatorConstructor: CodegenGeneratorConstructor): CodegenGenerator {
	const generator = generatorConstructor(config, context)
	context.setGenerator(generator)
	return generator
}

export function createCodegenState(generator: CodegenGenerator): CodegenState {
	return {
		generator,
	}
}

export async function createCodegenInput(inputPath: string): Promise<CodegenInput> {
	const parser = new SwaggerParser()
	/* Parse the document _without_ resolving references, as we use the presence of a reference
	   as important information in our parsing.
	 */
	const root = await parser.parse(inputPath)

	/* Create the references resolver, including resolving external references */
	const $refs = await parser.resolve(inputPath, root, {})
	
	return {
		root, 
		$refs,
	}
}

export async function bundleCodegenInput(inputPath: string): Promise<OpenAPI.Document> {
	const parser = new SwaggerParser()
	return await parser.bundle(inputPath)
}

/**
 * Return a CodegenDocument produced from the given CodegenState.
 * @param state 
 */
export function createCodegenDocument(input: CodegenInput, state: CodegenState): CodegenDocument {
	const internalState: InternalCodegenState = {
		...state,
		...input,
		usedFullyQualifiedSchemaNames: {},
		knownSchemas: new Map(),
		knownSchemasByRef: new Map(),
		reservedSchemaNames: {},
		schemas: idx.create(),
		specVersion: toSpecVersion(input.root),
		log: state.log || defaultLog,
	}

	return processDocument(internalState)
}
