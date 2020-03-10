import SwaggerParser from 'swagger-parser'
import { OpenAPI } from 'openapi-types'
import path from 'path'
import { CodegenState, CodegenConfig } from '../src/types'
import { TestGenerator } from './generator'

export async function createTestState(specName: string): Promise<CodegenState> {
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
