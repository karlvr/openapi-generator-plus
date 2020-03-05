import SwaggerParser from 'swagger-parser'
import { OpenAPI } from 'openapi-types'
import { promises as fs } from 'fs'
import { CodegenGenerator, CodegenState, CodegenConfig, processDocument } from '@openapi-generator-plus/core'
import getopts from 'getopts'
import YAML from 'yaml'

import path from 'path'

async function loadConfig(path: string): Promise<CodegenConfig> {
	const configContents = await fs.readFile(path, {
		encoding: 'UTF-8',
	}) as string

	if (path.endsWith('.yml') || path.endsWith('.yaml')) {
		return YAML.parse(configContents, {
			prettyErrors: true,
		} as any) // TODO the YAML types don't include prettyErrors
	} else {
		return JSON.parse(configContents)
	}
}

function usage() {
	console.log(`usage: ${process.argv[1]} [-c <config file>] -o <output dir> -g <generator module or path> <path or url to api spec>`)
}

export async function run() {
	const commandLineOptions = getopts(process.argv.slice(2), {
		alias: {
			config: 'c',
			output: 'o',
			generator: 'g',
		},
		unknown: (option) => {
			console.log(`Unknown option: ${option}`)
			return false
		},
	})

	let config: CodegenConfig
	if (commandLineOptions.config) {
		config = await loadConfig(commandLineOptions.config)
		config.config = commandLineOptions.config
		if (commandLineOptions.generator) {
			config.generator = commandLineOptions.generator
		}
		if (commandLineOptions.output) {
			config.output = commandLineOptions.output
		}
		if (commandLineOptions._.length) {
			config.input = commandLineOptions._[0]
		}
	} else {
		config = {
			generator: commandLineOptions.generator,
			output: commandLineOptions.output,
			input: commandLineOptions._[0],
		}
	}

	if (!config.input) {
		console.warn('API specification not specified')
		usage()
		process.exit(1)
	}
	if (!config.output) {
		console.warn('Output path not specified')
		usage()
		process.exit(1)
	}
	if (!config.generator) {
		console.warn('Generator not specified')
		usage()
		process.exit(1)
	}

	const parser = new SwaggerParser()

	let root: OpenAPI.Document
	try {
		root = await parser.parse(config.input)
	} catch (error) {
		console.error(`Failed to load API specification: ${config.input} (${error.message})`)
		process.exit(1)
	}

	let generator: CodegenGenerator
	try {
		generator = require(path.resolve(config.generator)).default
	} catch (error) {
		console.error(`Failed to load generator module: ${config.generator} (${error.message})`)
		process.exit(1)
	}

	const state: CodegenState = {
		parser,
		root,
		generator,
		config,
		options: generator.options(config),
		anonymousModels: {},
	}

	const doc = processDocument(root, state)

	await generator.exportTemplates(doc, state)
}

run()
