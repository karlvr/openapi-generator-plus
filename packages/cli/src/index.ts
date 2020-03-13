import SwaggerParser from 'swagger-parser'
import { OpenAPI } from 'openapi-types'
import { promises as fs } from 'fs'
import { CodegenGenerator, CodegenState, processDocument, CodegenDocument, toSpecVersion, CodegenConfig } from '@openapi-generator-plus/core'
import getopts from 'getopts'
import path from 'path'
import { CommandLineOptions } from './types'
import { createConfig } from './config'
import watch from 'node-watch'

function usage() {
	console.log(`usage: ${process.argv[1]} [-c <config file>] [-o <output dir>] [-g <generator module or path>] [--watch] [<path or url to api spec>]`)
}

async function createGenerator(config: CodegenConfig): Promise<CodegenGenerator> {
	const generatorPath = path.resolve(config.generator)
	try {
		await fs.access(generatorPath)
		return require(generatorPath).default
	} catch (error) {
		/* Resolve generator as a local module */
		const resolved = require.resolve(config.generator, { paths: ['.'] })
		return require(resolved).default
	}
}

async function generate(config: CodegenConfig): Promise<boolean> {
	const parser = new SwaggerParser()

	let root: OpenAPI.Document
	try {
		root = await parser.parse(config.inputPath)
	} catch (error) {
		console.error(`Failed to load API specification: ${config.inputPath} (${error.message})`)
		return false
	}

	let generator: CodegenGenerator
	try {
		generator = await createGenerator(config)
	} catch (error) {
		console.error(`Failed to load generator module: ${config.generator} (${error.message})`)
		return false
	}

	const state: CodegenState = {
		parser,
		root,
		generator,
		config,
		options: generator.options(config),
		anonymousModels: {},
		specVersion: toSpecVersion(root),
	}

	let doc: CodegenDocument
	try {
		doc = processDocument(state)
	} catch (error) {
		if (error.message) {
			console.error(`Failed to process the API specification: ${error.message}`)
		} else {
			console.error('Failed to process the API specification', error)
		}
		return false
	}

	try {
		await generator.exportTemplates(doc, state)
	} catch (error) {
		console.error(`Failed to generate templates: ${error.message}`)
		return false
	}

	return true
}

export async function run() {
	const commandLineOptions: CommandLineOptions = getopts(process.argv.slice(2), {
		alias: {
			config: 'c',
			output: 'o',
			generator: 'g',
			version: 'v',
		},
		boolean: ['watch'],
		unknown: (option) => {
			console.log(`Unknown option: ${option}`)
			return false
		},
	})

	if (commandLineOptions.version) {
		const version = require(path.resolve(__dirname, '../package.json')).version
		console.log(version)
		process.exit(0)
	}

	const config = await createConfig(commandLineOptions)

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

	const result = await generate(config)
	if (!result) {
		process.exit(1)
	}
	
	if (commandLineOptions.watch) {
		const watchPaths: string[] = []
		if (config.inputPath.indexOf('://') === -1) {
			watchPaths.push(config.inputPath)
		} else {
			console.warn('Not watching for API specification changes as it is not a local file path')
		}

		const generatorWatchPaths = (await createGenerator(config)).watchPaths(config)
		if (generatorWatchPaths) {
			watchPaths.push(...generatorWatchPaths)
		}

		if (!watchPaths.length) {
			console.warn('No paths are available to watch')
			process.exit(1)
		}
		
		let running = false
		watch(watchPaths, () => {
			if (running) {
				return
			}
			running = true
			
			console.log(`Rebuilding ${config.inputPath} to ${config.outputPath}…`)
			generate(config).then(result => {
				if (result) {
					console.log('Complete')
				}
				running = false
			}).catch(error => {
				if (error.message) {
					console.error(`Failed to generate: ${error.message}`)
				} else {
					console.error('Failed to generate', error)
				}
			})
		})
	}
}

run()
