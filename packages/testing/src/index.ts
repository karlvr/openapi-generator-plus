import { CodegenDocument, CodegenState, CodegenConfig, CodegenGeneratorConstructor } from '@openapi-generator-plus/types'
import { constructGenerator, createCodegenState, createCodegenInput, createCodegenDocument } from '@openapi-generator-plus/core'

export interface CodegenResult<O> {
	doc: CodegenDocument
	state: CodegenState<O>
}

export async function createCodegenResult<O>(inputPath: string, config: CodegenConfig, generatorConstructor: CodegenGeneratorConstructor<O>): Promise<CodegenResult<O>> {
	const generator = constructGenerator(generatorConstructor)
	const state = createCodegenState(config, generator)
	const input = await createCodegenInput(inputPath)
	const doc = createCodegenDocument(input, state)
	return {
		doc,
		state,
	}
}
