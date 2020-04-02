import { CodegenOptions, CodegenGeneratorConstructor } from '@openapi-generator-plus/types'
import { addToGroupsByPath } from '../operation-grouping'

export interface TestCodegenOptions extends CodegenOptions {

}

export const createTestGenerator: CodegenGeneratorConstructor<TestCodegenOptions> = (generatorOptions) => ({
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
