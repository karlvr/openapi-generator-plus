import testGeneratorConstructor, { TestCodegenConfig } from '@openapi-generator-plus/test-generator'
import { CodegenConfig, CodegenDocument, CodegenGenerator, CodegenLogLevel, CodegenState } from '@openapi-generator-plus/types'
import path from 'path'
import { constructGenerator, createCodegenDocument, createCodegenInput, createCodegenState } from '..'
import { createGeneratorContext } from '../generators'
import { isURL } from '../utils'

export function createTestGenerator(config?: TestCodegenConfig): CodegenGenerator {
	
	return constructGenerator(config as CodegenConfig || {}, createGeneratorContext(), testGeneratorConstructor)
}

export async function createTestDocument(inputPath: string, config?: TestCodegenConfig): Promise<CodegenDocument> {
	return (await createTestResult(inputPath, config)).result
}

export interface TestResult {
	result: CodegenDocument
	state: CodegenState
}

export async function createTestResult(inputPath: string, config?: TestCodegenConfig): Promise<TestResult> {
	const generator = createTestGenerator(config)
	const state = createTestCodegenState(generator, config)
	const input = await createCodegenInput(isURL(inputPath) ? inputPath : path.resolve(__dirname, inputPath))
	const result = createCodegenDocument(input, state)
	return {
		result,
		state,
	}
}

function createTestCodegenState(generator: CodegenGenerator, config?: TestCodegenConfig): CodegenState {
	const state = createCodegenState({}, generator)
	state.log = function(level, message) {
		if (level >= CodegenLogLevel.WARN && (!config || !config.expectLogWarnings)) {
			/* We should not emit any warning messages during the tests */
			throw new Error(`Warning message generated: ${message}`)
		}
	}
	return state
}
