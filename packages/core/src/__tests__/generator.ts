import { CodegenGenerator, CodegenOptions, CodegenNativeType } from '../types'
import { addToGroupsByPath } from '../operation-grouping'

export interface TestCodegenOptions extends CodegenOptions {

}

export const TestGenerator: CodegenGenerator<TestCodegenOptions> = {
	toClassName: (name) => `class ${name}`,
	toIdentifier: (name) => `identifier ${name}`,
	toConstantName: (name) => `constant ${name}`,
	toEnumName: (name) => `enum ${name}`,
	toOperationName: (path, method) => `operation ${method} ${path}`,
	toModelNameFromPropertyName: (name) => `model ${name}`,
	toLiteral: (value) => `literal ${value}`,
	toNativeType: (options) => options.modelNames ? new CodegenNativeType(options.modelNames[options.modelNames.length - 1]) : new CodegenNativeType(options.type),
	toNativeArrayType: (options) => new CodegenNativeType(`array ${options.componentNativeType}`),
	toNativeMapType: (options) => new CodegenNativeType(`map ${options.componentNativeType}`),
	toDefaultValue: (defaultValue, options) => `default ${options.type}`,
	options: (config) => ({ config }),
	operationGroupingStrategy: () => addToGroupsByPath,
	exportTemplates: () => {
		// NOOP
	},
	watchPaths: () => [],
	cleanPathPatterns: () => undefined,
}
