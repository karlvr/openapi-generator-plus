import SwaggerParser from 'swagger-parser'
import { OpenAPI } from 'openapi-types'
import { promises as fs } from 'fs'
import { CodegenGenerator, CodegenState, processDocument, CodegenDocument, toSpecVersion, CodegenConfig } from '@openapi-generator-plus/core'
import getopts from 'getopts'
import path from 'path'
import { CommandLineOptions } from './types'
import { createConfig } from './config'
import watch from 'node-watch'
import glob from 'glob-promise'

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

async function clean(notModifiedSince: number, config: CodegenConfig) {
	const generator = await createGenerator(config)
	const options = generator.options(config)
	const cleanPathPatterns = generator.cleanPathPatterns(options)
	if (!cleanPathPatterns) {
		return
	}

	console.log(`Cleaning: ${cleanPathPatterns.join(' ')}`)

	const outputPath = config.outputPath
	const paths: string[] = []
	for (const pattern of cleanPathPatterns) {
		paths.push(...await glob(pattern, {
			cwd: outputPath,
			nodir: true,
			follow: false,
		}))
	}

	for (const aPath of paths) {
		const absolutePath = path.resolve(outputPath, aPath)
		if (!absolutePath.startsWith(outputPath)) {
			console.warn(`Invalid clean path not under outputPath: ${absolutePath}`)
			continue
		}

		try {
			const stats = await fs.stat(absolutePath)
			if (stats.mtime.getTime() < notModifiedSince) {
				await fs.unlink(absolutePath)
			}
		} catch (error) {
			console.warn(`Failed to clean path: ${absolutePath}: ${error.message}`)
		}
	}
}

export async function run() {
	const commandLineOptions: CommandLineOptions = getopts(process.argv.slice(2), {
		alias: {
			config: 'c',
			output: 'o',
			generator: 'g',
			version: 'v',
		},
		boolean: ['watch', 'clean'],
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

	let config: CodegenConfig
	try {
		config = await createConfig(commandLineOptions)
	} catch (error) {
		console.error(`Failed to open config file: ${error}`)
		process.exit(1)
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

	const beforeGeneration = Date.now()
	const result = await generate(config)
	if (!result) {
		process.exit(1)
	}

	if (commandLineOptions.clean) {
		await clean(beforeGeneration, config)
	}

	console.log(`Generated in ${Date.now() - beforeGeneration}ms: ${config.outputPath}`)
	
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
		watch(watchPaths, { recursive: true }, async() => {
			if (running) {
				return
			}
			running = true

			const beforeGeneration = Date.now()
			console.log(`Rebuilding: ${config.inputPath}…`)
			try {
				const result = await generate(config)
				if (result) {
					console.log(`Generated in ${Date.now() - beforeGeneration}ms: ${config.outputPath}`)

					if (commandLineOptions.clean) {
						await clean(beforeGeneration, config)
					}
				}
				running = false
			} catch (error) {
				if (error.message) {
					console.error(`Failed to generate: ${error.message}`)
				} else {
					console.error('Failed to generate', error)
				}
				running = false
			}
		})
	}
}

run()
