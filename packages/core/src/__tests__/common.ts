import { CodegenGeneratorConstructor, CodegenGenerator, CodegenDocument, CodegenState, CodegenConfig, CodegenGeneratorType } from '@openapi-generator-plus/types'
import { addToGroupsByPath } from '../operation-grouping'
import { constructGenerator, createCodegenState, createCodegenDocument, createCodegenInput } from '..'
import path from 'path'

export interface TestCodegenOptions {
	config: CodegenConfig
}

const testGeneratorConstructor: CodegenGeneratorConstructor<TestCodegenOptions> = (generatorOptions) => ({
	generatorType: () => CodegenGeneratorType.SERVER,
	toClassName: (name) => `${name}_class`,
	toIdentifier: (name) => `${name}_identifier`,
	toConstantName: (name) => `${name}_contant`,
	toEnumName: (name) => `${name}_enum`,
	toEnumMemberName: (name) => `${name}_enum_member`,
	toOperationName: (path, method) => `${method} ${path} operation`,
	toModelNameFromPropertyName: (name) => `${name}_model`,
	toIteratedModelName: (name, _, iteration) => `${name}${iteration}`,
	toLiteral: (value) => `literal ${value}`,
	toNativeType: (options) => new generatorOptions.NativeType(options.type),
	toNativeObjectType: (options) => new generatorOptions.NativeType(options.modelNames.join('.')),
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
	generateCollectionModels: (options) => !!options.config.collectionModelsAllowed,
})

export function createTestGenerator(): CodegenGenerator<TestCodegenOptions> {
	return constructGenerator(testGeneratorConstructor)
}

export async function createTestDocument(inputPath: string, config?: CodegenConfig): Promise<CodegenDocument> {
	return (await createTestResult(inputPath, config)).result
}

export interface TestResult {
	result: CodegenDocument
	state: CodegenState<TestCodegenOptions>
}

export async function createTestResult(inputPath: string, config?: CodegenConfig): Promise<TestResult> {
	const generator = createTestGenerator()
	const state = createCodegenState(config || {}, generator)
	const input = await createCodegenInput(path.resolve(__dirname, inputPath))
	const result = createCodegenDocument(input, state)
	return {
		result,
		state,
	}
}
