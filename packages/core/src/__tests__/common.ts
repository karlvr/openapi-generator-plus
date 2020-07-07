import { CodegenGeneratorConstructor, CodegenGenerator, CodegenDocument, CodegenState, CodegenGeneratorType, CodegenPropertyType, CodegenGeneratorContext, CodegenOperationGroupingStrategy, CodegenSchemaType } from '@openapi-generator-plus/types'
import { addToGroupsByPath } from '../operation-grouping'
import { constructGenerator, createCodegenState, createCodegenDocument, createCodegenInput } from '..'
import path from 'path'

interface TestCodegenOptions {

}

export interface TestCodegenConfig {
	collectionModelsAllowed?: boolean
	operationGroupingStrategy?: CodegenOperationGroupingStrategy<TestCodegenOptions>
}

export interface TestCodegenGeneratorContext extends CodegenGeneratorContext, TestCodegenConfig {
	
}

const testGeneratorConstructor: CodegenGeneratorConstructor<TestCodegenOptions, TestCodegenGeneratorContext> = (generatorContext) => ({
	generatorType: () => CodegenGeneratorType.SERVER,
	toClassName: (name) => `${name}_class`,
	toIdentifier: (name) => `${name}_identifier`,
	toConstantName: (name) => `${name}_contant`,
	toEnumMemberName: (name) => `${name}_enum_member`,
	toOperationName: (path, method) => `${method} ${path} operation`,
	toOperationGroupName: (name) => `${name} api`,
	toSchemaName: (name, options) => {
		if (options.nameSpecified) {
			return `${name}`
		} else if (options.schemaType === CodegenSchemaType.ENUM) {
			return `${name}_enum`
		} else {
			return `${name}_model`
		}
	},
	toIteratedModelName: (name, _, iteration) => `${name}${iteration}`,
	toLiteral: (value) => `literal ${value}`,
	toNativeType: (options) => new generatorContext.NativeType(options.type),
	toNativeObjectType: (options) => new generatorContext.NativeType(options.modelNames.join('.')),
	toNativeArrayType: (options) => new generatorContext.NativeType(`array ${options.componentNativeType}`),
	toNativeMapType: (options) => new generatorContext.NativeType(`map ${options.componentNativeType}`),
	toDefaultValue: (defaultValue, options, state) => {
		if (defaultValue) {
			return { value: defaultValue, literalValue: state.generator.toLiteral(defaultValue, options, state) }
		}

		if (!options.required) {
			return { literalValue: 'undefined' }
		}

		switch (options.propertyType) {
			case CodegenPropertyType.ARRAY:
				return { value: [], literalValue: '[]' }
			case CodegenPropertyType.OBJECT:
				return { value: {}, literalValue: '{}' }
			case CodegenPropertyType.NUMBER:
				return { value: 0, literalValue: '0' }
			case CodegenPropertyType.BOOLEAN:
				return { value: false, literalValue: 'false' }
			default:
				return { literalValue: 'undefined' }
		}
	},
	options: (config) => ({ config }),
	operationGroupingStrategy: () => generatorContext.operationGroupingStrategy || addToGroupsByPath,
	exportTemplates: async() => {
		// NOOP
	},
	watchPaths: () => [],
	cleanPathPatterns: () => undefined,
	generateCollectionModels: () => !!generatorContext.collectionModelsAllowed,
})

export function createTestGenerator(config?: TestCodegenConfig): CodegenGenerator<TestCodegenOptions> {
	return constructGenerator((context) => testGeneratorConstructor({ ...context, ...config }))
}

export async function createTestDocument(inputPath: string, config?: TestCodegenConfig): Promise<CodegenDocument> {
	return (await createTestResult(inputPath, config)).result
}

export interface TestResult {
	result: CodegenDocument
	state: CodegenState<TestCodegenOptions>
}

export async function createTestResult(inputPath: string, config?: TestCodegenConfig): Promise<TestResult> {
	const generator = createTestGenerator(config)
	const state = createCodegenState(config || {}, generator)
	const input = await createCodegenInput(path.resolve(__dirname, inputPath))
	const result = createCodegenDocument(input, state)
	return {
		result,
		state,
	}
}
