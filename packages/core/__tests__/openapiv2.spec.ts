import SwaggerParser from 'swagger-parser'
import { OpenAPI } from 'openapi-types'
import path from 'path'
import { processDocument } from '../src/process'
import { CodegenState, CodegenGenerator, CodegenConfig, CodegenOptions, CodegenTypeOptions, CodegenNativeTypeOptions, CodegenNativeMapTypeOptions, CodegenNativeType, CodegenNativeArrayTypeOptions } from '../src/types'
import { addToGroupsByPath } from '../src/operation-grouping'

interface TestCodegenOptions extends CodegenOptions {

}

const TestGenerator: CodegenGenerator<TestCodegenOptions> = {
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

async function createTestState(specName: string): Promise<CodegenState> {
	const parser = new SwaggerParser()

	const root: OpenAPI.Document = await parser.parse(path.resolve(__dirname, specName))

	const config: CodegenConfig = {
		inputPath: '',
		outputPath: '',
		generator: '',
	}
	const state: CodegenState = {
		root,
		parser,
		generator: TestGenerator,
		config,
		options: {
			config,
		},
		anonymousModels: {},
	}
	return state
}

test('parse OpenAPIv2 info', async() => {
	const state = await createTestState('openapiv2-1.yml')
	const result = processDocument(state)

	expect(result.info.description).toEqual('Lorem ipsum')
	expect(result.info.version).toEqual('1.0.1')
	expect(result.info.title).toEqual('Example')
	expect(result.servers).toBeDefined()
	expect(result.servers![0].url).toEqual('http://example.com/api/v1')
	expect(result.servers![1].url).toEqual('https://example.com/api/v1')
})

test('parse OpenAPIv2 groups', async() => {
	const state = await createTestState('openapiv2-1.yml')
	const result = processDocument(state)

	expect(result.groups.length).toEqual(2)
	const group1 = result.groups[0]
	expect(group1.name).toEqual('test1')
	expect(group1.path).toEqual('/test1')
	expect(group1.operations.length).toEqual(2)

	const op1 = group1.operations[0]
	expect(op1.name).toEqual('getTest1')
	expect(op1.allParams).toBeDefined()
	expect(op1.allParams!.length).toEqual(1)

	expect(op1.returnType).toEqual('object')
	expect(op1.returnNativeType?.toString()).toEqual('Test1Response')

	const group2 = result.groups[1]
	expect(group2.name).toEqual('test2')
	expect(group2.operations.length).toEqual(1)

	const op2 = group2.operations[0]
	expect(op2.name).toEqual(state.generator.toOperationName('/test2', 'GET', state)) /* Uses default name */
	expect(op2.allParams!.length).toEqual(1)
	expect(op2.returnType).not.toBeDefined()
	expect(op2.returnNativeType).not.toBeDefined()
})
