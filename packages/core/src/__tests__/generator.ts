import { CodegenGenerator, CodegenOptions, CodegenNativeType } from '../types'
import { addToGroupsByPath } from '../operation-grouping'
import { pascalCase, camelCase } from '../case-transforms'

export interface TestCodegenOptions extends CodegenOptions {

}

export const TestGenerator: CodegenGenerator<TestCodegenOptions> = {
	toClassName: (name) => pascalCase(`${name}_class`),
	toIdentifier: (name) => camelCase(`${name}_identifier`),
	toConstantName: (name) => camelCase(`${name}_contant`),
	toEnumName: (name) => pascalCase(`${name}_enum`),
	toOperationName: (path, method) => camelCase(`${method} ${path} operation`),
	toModelNameFromPropertyName: (name) => pascalCase(`${name}_model`),
	toLiteral: (value) => `literal ${value}`,
	toNativeType: (options) => options.modelNames ? new CodegenNativeType(options.modelNames.join('.')) : new CodegenNativeType(options.type),
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
