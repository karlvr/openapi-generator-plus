import SwaggerParser from 'swagger-parser'
import { OpenAPI } from 'openapi-types'
import path from 'path'
import { CodegenState, CodegenConfig, CodegenOptions } from '@openapi-generator-plus/types'
import { TestGenerator } from './generator'
import { toSpecVersion } from '../'

export async function createTestState(specName: string): Promise<CodegenState<CodegenOptions>> {
	const parser = new SwaggerParser()

	const root: OpenAPI.Document = await parser.parse(path.resolve(__dirname, specName))

	const config: CodegenConfig = {
		inputPath: '',
		outputPath: '',
		generator: '',
	}
	const state: CodegenState<CodegenOptions> = {
		root,
		parser,
		generator: TestGenerator,
		config,
		options: {
			config,
		},
		specVersion: toSpecVersion(root),
	}
	return state
}
