import { CodegenGeneratorConstructor, CodegenGenerator, CodegenDocument, CodegenState } from '@openapi-generator-plus/types'
import { addToGroupsByPath } from '../operation-grouping'
import { constructGenerator, createCodegenState, createCodegenDocument, createCodegenInput } from '..'
import path from 'path'

export interface TestCodegenOptions {

}

const testGeneratorConstructor: CodegenGeneratorConstructor<TestCodegenOptions> = (generatorOptions) => ({
	toClassName: (name) => `${name}_class`,
	toIdentifier: (name) => `${name}_identifier`,
	toConstantName: (name) => `${name}_contant`,
	toEnumName: (name) => `${name}_enum`,
	toOperationName: (path, method) => `${method} ${path} operation`,
	toModelNameFromPropertyName: (name) => `${name}_model`,
	toIteratedModelName: (name, _, iteration) => `${name}${iteration}`,
	toLiteral: (value) => `literal ${value}`,
	toNativeType: (options) => options.modelNames ? new generatorOptions.NativeType(options.modelNames.join('.')) : new generatorOptions.NativeType(options.type),
	toNativeArrayType: (options) => new generatorOptions.NativeType(`array ${options.componentNativeType}`),
	toNativeMapType: (options) => new generatorOptions.NativeType(`map ${options.componentNativeType}`),
	toDefaultValue: (defaultValue, options) => `default ${options.type}`,
	options: (config) => ({ config }),
	operationGroupingStrategy: () => addToGroupsByPath,
	exportTemplates: () => {
		// NOOP
	},
	watchPaths: () => [],
	cleanPathPatterns: () => undefined,
})

export function createTestGenerator(): CodegenGenerator<TestCodegenOptions> {
	return constructGenerator(testGeneratorConstructor)
}

export async function createTestDocument(inputPath: string): Promise<CodegenDocument> {
	return (await createTestResult(inputPath)).result
}

export interface TestResult {
	result: CodegenDocument
	state: CodegenState<TestCodegenOptions>
}

export async function createTestResult(inputPath: string): Promise<TestResult> {
	const generator = createTestGenerator()
	const state = createCodegenState({}, generator)
	const input = await createCodegenInput(path.resolve(__dirname, inputPath))
	const result = createCodegenDocument(input, state)
	return {
		result,
		state,
	}
}
