import { promises as fs } from 'fs'
import { constructGenerator, createCodegenDocument, createCodegenState, createCodegenInput } from '@openapi-generator-plus/core'
import { CodegenDocument, CodegenConfig, CodegenGeneratorConstructor } from '@openapi-generator-plus/types'
import getopts from 'getopts'
import path from 'path'
import { CommandLineOptions, CommandLineConfig } from './types'
import { createConfig } from './config'
import watch from 'node-watch'
import glob from 'glob-promise'
import { loadGeneratorConstructor } from './generator'

function usage() {
	console.log(`usage: ${process.argv[1]} [-c <config file>] [-o <output dir>] [-g <generator module or path>] [--watch] [<path or url to api spec>]`)
}

async function generate(config: CommandLineConfig, generatorConstructor: CodegenGeneratorConstructor<{}>): Promise<boolean> {
	const generator = constructGenerator(generatorConstructor)

	const state = createCodegenState(config, generator)
	const input = await createCodegenInput(config.inputPath)

	let doc: CodegenDocument
	try {
		doc = createCodegenDocument(input, state)
	} catch (error) {
		console.error('Failed to process the API specification', error)
		return false
	}

	try {
		generator.exportTemplates(config.outputPath, doc, state)
	} catch (error) {
		console.error('Failed to generate templates', error)
		return false
	}

	return true
}

async function clean(notModifiedSince: number, config: CodegenConfig, generatorConstructor: CodegenGeneratorConstructor<{}>) {
	const generator = constructGenerator(generatorConstructor)
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

	let config: CommandLineConfig
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

	let generatorConstructor: CodegenGeneratorConstructor<{}>
	try {
		generatorConstructor = await loadGeneratorConstructor(config.generator)
	} catch (error) {
		console.error(`Failed to load generator module: ${config.generator}`, error)
		process.exit(1)
	}

	const beforeGeneration = Date.now()
	const result = await generate(config, generatorConstructor)
	if (!result) {
		process.exit(1)
	}

	console.log(`Generated in ${Date.now() - beforeGeneration}ms: ${config.outputPath}`)

	if (commandLineOptions.clean) {
		await clean(beforeGeneration, config, generatorConstructor)
	}
	
	if (commandLineOptions.watch) {
		const watchPaths: string[] = []
		if (config.inputPath.indexOf('://') === -1) {
			watchPaths.push(config.inputPath)
		} else {
			console.warn('Not watching for API specification changes as it is not a local file path')
		}

		const generatorWatchPaths = constructGenerator(generatorConstructor).watchPaths(config)
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
				const result = await generate(config, generatorConstructor)
				if (result) {
					console.log(`Generated in ${Date.now() - beforeGeneration}ms: ${config.outputPath}`)

					if (commandLineOptions.clean) {
						await clean(beforeGeneration, config, generatorConstructor)
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
