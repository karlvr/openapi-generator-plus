import { CodegenGenerator, CodegenConfig, CodegenOptions, CodegenTypeOptions, CodegenNativeTypeOptions, CodegenNativeMapTypeOptions, CodegenNativeType, CodegenNativeArrayTypeOptions } from '../src/types'
import { addToGroupsByPath } from '../src/operation-grouping'

export interface TestCodegenOptions extends CodegenOptions {

}

export const TestGenerator: CodegenGenerator<TestCodegenOptions> = {
	toClassName: (name: string) => `class ${name}`,
	toIdentifier: (name: string) => `identifier ${name}`,
	toConstantName: (name: string) => `constant ${name}`,
	toEnumName: (name: string) => `enum ${name}`,
	toOperationName: (path: string, method: string) => `operation ${method} ${path}`,
	toModelNameFromPropertyName: (name: string) => `model ${name}`,
	toLiteral: (value: any) => `literal ${value}`,
	toNativeType: (options: CodegenNativeTypeOptions) => options.modelNames ? new CodegenNativeType(options.modelNames[options.modelNames.length - 1]) : new CodegenNativeType(options.type),
	toNativeArrayType: (options: CodegenNativeArrayTypeOptions) => new CodegenNativeType(`array ${options.componentNativeType}`),
	toNativeMapType: (options: CodegenNativeMapTypeOptions) => new CodegenNativeType(`map ${options.componentNativeType}`),
	toDefaultValue: (defaultValue: any, options: CodegenTypeOptions) => `default ${options.type}`,
	options: (config: CodegenConfig) => ({ config }),
	operationGroupingStrategy: () => addToGroupsByPath,
	exportTemplates: () => {
		// NOOP
	},
}
