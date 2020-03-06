import SwaggerParser from 'swagger-parser'
import { OpenAPI } from 'openapi-types'
import { promises as fs } from 'fs'
import { CodegenGenerator, CodegenState, CodegenConfig, processDocument, CodegenDocument } from '@openapi-generator-plus/core'
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
	const configPath = commandLineOptions.config
	if (configPath) {
		config = await loadConfig(configPath)
		config.configPath = configPath
		if (config.outputPath) {
			config.outputPath = path.resolve(path.dirname(configPath), config.outputPath)
		}
		if (config.inputPath) {
			config.inputPath = path.resolve(path.dirname(configPath), config.inputPath)
		}
		if (commandLineOptions.generator) {
			config.generator = commandLineOptions.generator
		}
		if (commandLineOptions.output) {
			config.outputPath = commandLineOptions.output
		}
		if (commandLineOptions._.length) {
			config.inputPath = commandLineOptions._[0]
		}
	} else {
		config = {
			generator: commandLineOptions.generator,
			outputPath: commandLineOptions.output,
			inputPath: commandLineOptions._[0],
		}
	}

	if (!config.inputPath) {
		console.warn('API specification not specified')
		usage()
		process.exit(1)
	}
	if (!config.outputPath) {
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
		root = await parser.parse(config.inputPath)
	} catch (error) {
		console.error(`Failed to load API specification: ${config.input} (${error.message})`)
		process.exit(1)
	}

	let generator: CodegenGenerator
	try {
		const generatorPath = path.resolve(config.generator)
		try {
			await fs.access(generatorPath)
			generator = require(generatorPath).default
		} catch (error) {
			/* Resolve generator as a local module */
			const resolved = require.resolve(config.generator, { paths: ['.'] })
			generator = require(resolved).default
		}
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

	let doc: CodegenDocument
	try {
		doc = processDocument(root, state)
	} catch (error) {
		console.error(`Failed to process the API specification: ${error.message}`)
		process.exit(1)
	}

	try {
		await generator.exportTemplates(doc, state)
	} catch (error) {
		console.error(`Failed to generate templates: ${error.message}`)
		process.exit(1)
	}
}

run()
