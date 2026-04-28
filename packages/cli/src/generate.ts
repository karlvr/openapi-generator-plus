import { promises as fs } from 'fs'
import { activateExtensionsInOpenAPISpec, bundleCodegenInput, constructGenerator, createCodegenDocument, createCodegenState, createCodegenInput, createGeneratorContext, filterOpenAPISpec, mergeOpenAPISpecs } from '@openapi-generator-plus/core'
import { CodegenDocument, CodegenConfig, CodegenGeneratorConstructor, CodegenInputDocument } from '@openapi-generator-plus/types'
import getopts from 'getopts'
import path from 'path'
import { CommandLineOptions, CommandLineConfig } from './types'
import { createConfig } from './config'
import { FILTER_STRING_OPTIONS, hasAnyFilter } from './filter'
import { ACTIVATE_EXTENSION_STRING_OPTIONS } from './activate-extensions'
import watch from 'node-watch'
import { glob } from 'glob'
import { loadGeneratorConstructor } from './generator'
import c from 'ansi-colors'
import { usage } from './usage'
import { log } from './log'
import fetch from 'node-fetch'
import { isURL } from '@openapi-generator-plus/core/dist/utils'

function createMyGeneratorContext() {
	return createGeneratorContext({
		log,
	})
}

async function createCodegenInputPossiblyWithUrl(inputPathOrUrl: string): Promise<CodegenInputDocument> {
	if (isURL(inputPathOrUrl)) {
		console.info(c.bold.green('Downloading:'), inputPathOrUrl)

		const startTime = Date.now()
		const response = await fetch(inputPathOrUrl)
		if (!response.ok) {
			throw new Error(`Download failed with status ${response.status}: ${inputPathOrUrl}`)
		}

		const text = await response.text()
		console.info(c.bold.green(`Downloaded in ${Date.now() - startTime}ms:`), inputPathOrUrl)

		const tempDir = await fs.mkdtemp('openapi-generator-plus')
		const tempFile = path.resolve(tempDir, path.basename(inputPathOrUrl) || 'openapi.yaml')
		fs.writeFile(tempFile, text)

		try {
			return await createCodegenInput(tempFile)
		} finally {
			await fs.unlink(tempFile)
			await fs.rmdir(tempDir)
		}
	} else {
		return await createCodegenInput(inputPathOrUrl)
	}
}

async function createCodegenInputForPaths(inputPaths: string[]): Promise<CodegenInputDocument> {
	if (inputPaths.length === 1) {
		return await createCodegenInputPossiblyWithUrl(inputPaths[0])
	}

	const docs = await Promise.all(inputPaths.map(p => bundleCodegenInput(p)))
	const merged = mergeOpenAPISpecs(docs, {
		onCollision: ({ kind, key }) => {
			console.warn(c.yellow(`Warning: collision while merging ${kind}: ${key} (last input wins)`))
		},
	})

	const tempDir = await fs.mkdtemp('openapi-generator-plus')
	const tempFile = path.resolve(tempDir, 'merged-openapi.json')
	await fs.writeFile(tempFile, JSON.stringify(merged))
	try {
		return await createCodegenInput(tempFile)
	} finally {
		await fs.unlink(tempFile)
		await fs.rmdir(tempDir)
	}
}

async function generate(config: CommandLineConfig, generatorConstructor: CodegenGeneratorConstructor): Promise<boolean> {
	const generator = constructGenerator(config, createMyGeneratorContext(), generatorConstructor)
	
	const state = createCodegenState(config, generator)
	state.log = log
	
	const inputPaths = Array.isArray(config.inputPath) ? config.inputPath : [config.inputPath]

	let input: CodegenInputDocument
	try {
		input = await createCodegenInputForPaths(inputPaths)
	} catch (error) {
		console.error(c.bold.red('Failed to get the API specification:'), error)
		return false
	}

	if (config.activateExtensions && config.activateExtensions.length) {
		activateExtensionsInOpenAPISpec(input.root, config.activateExtensions)
	}

	const filters = {
		includeTags: config.includeTags,
		excludeTags: config.excludeTags,
		includePaths: config.includePaths,
		excludePaths: config.excludePaths,
	}
	if (hasAnyFilter(filters)) {
		filterOpenAPISpec(input.root, filters)
	}

	let doc: CodegenDocument
	try {
		doc = createCodegenDocument(input, state)
	} catch (error) {
		console.error(c.bold.red('Failed to process the API specification:'), error)
		return false
	}

	try {
		await generator.exportTemplates(config.outputPath, doc)
	} catch (error) {
		console.error(c.bold.red('Failed to generate templates:'), error)
		return false
	}

	return true
}

async function clean(notModifiedSince: number, config: CodegenConfig, generatorConstructor: CodegenGeneratorConstructor) {
	const generator = constructGenerator(config, createMyGeneratorContext(), generatorConstructor)
	const cleanPathPatterns = generator.cleanPathPatterns()
	if (!cleanPathPatterns) {
		return
	}

	const outputPath = config.outputPath
	if (typeof outputPath !== 'string') {
		throw new Error('outputPath must be a string value')
	}
	console.log(c.bold.yellow('Cleaning:'), cleanPathPatterns.map(p => path.join(outputPath, p)).join(' '))

	const paths: string[] = []
	for (const pattern of cleanPathPatterns) {
		paths.push(...await glob(pattern, {
			cwd: outputPath,
			follow: false,
		}))
	}

	const dirsToCheck: string[] = []
	const resolvedOutputPath = path.resolve(outputPath)
	for (const aPath of paths) {
		const absolutePath = path.resolve(outputPath, aPath)
		if (!absolutePath.startsWith(resolvedOutputPath)) {
			console.warn(c.bold.red('Invalid clean path not under outputPath:'), absolutePath)
			continue
		}

		try {
			const stats = await fs.stat(absolutePath)
			if (stats.isDirectory()) {
				dirsToCheck.push(absolutePath)
			} else if (stats.mtime.getTime() < notModifiedSince) {
				await fs.unlink(absolutePath)
			}
		} catch (error) {
			console.error(c.bold.red('Failed to clean path:'), absolutePath, error)
		}
	}

	for (const absolutePath of dirsToCheck) {
		const files = await fs.readdir(absolutePath)
		if (files.length === 0) {
			await fs.rmdir(absolutePath)
		}
	}
}

export default async function generateCommand(argv: string[]): Promise<void> {
	const commandLineOptions: CommandLineOptions = getopts(argv, {
		alias: {
			config: 'c',
			output: 'o',
			generator: 'g',
			version: 'v',
		},
		boolean: ['watch', 'clean'],
		string: [...FILTER_STRING_OPTIONS, ...ACTIVATE_EXTENSION_STRING_OPTIONS],
		unknown: (option) => {
			console.log(`Unknown option: ${option}`)
			return false
		},
	})

	if (commandLineOptions.version) {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
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

	if (!config.inputPath || (Array.isArray(config.inputPath) && config.inputPath.length === 0)) {
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

	let generatorConstructor: CodegenGeneratorConstructor
	try {
		generatorConstructor = await loadGeneratorConstructor(config.generator)
	} catch (error) {
		console.error(`Failed to load generator template: ${config.generator}`, error)
		process.exit(1)
	}

	const startTime = Date.now()
	const beforeFilesystemTimestamp = await currentFilesystemTimestamp(config.outputPath)
	
	let result: boolean
	try {
		result = await generate(config, generatorConstructor)
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} catch (error: any) {
		if (error.message) {
			console.error(c.bold.red('Failed to generate:'), error.message)
		} else {
			console.error(c.bold.red('Failed to generate:'), error)
		}
		process.exit(1)
	}

	if (result) {
		console.log(c.bold.green(`Generated in ${Date.now() - startTime}ms:`), config.outputPath)
	}

	if (result && commandLineOptions.clean) {
		await clean(beforeFilesystemTimestamp, config, generatorConstructor)
	}
	
	if (commandLineOptions.watch) {
		const watchPaths: string[] = []
		const inputPaths = Array.isArray(config.inputPath) ? config.inputPath : [config.inputPath]
		for (const inputPath of inputPaths) {
			if (inputPath.indexOf('://') === -1) {
				watchPaths.push(inputPath)
			} else {
				console.warn(c.red('Not watching for API specification changes as it is not a local file path:'), inputPath)
			}
		}

		const generatorWatchPaths = constructGenerator(config, createMyGeneratorContext(), generatorConstructor).watchPaths()
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

			const startTime = Date.now()
			const beforeFilesystemTimestamp = await currentFilesystemTimestamp(config.outputPath)

			console.log(c.cyan('Rebuilding:'), Array.isArray(config.inputPath) ? config.inputPath.join(', ') : config.inputPath)
			try {
				const result = await generate(config, generatorConstructor)
				if (result) {
					console.log(c.bold.green(`Generated in ${Date.now() - startTime}ms:`), config.outputPath)

					if (commandLineOptions.clean) {
						await clean(beforeFilesystemTimestamp, config, generatorConstructor)
					}
				}
				running = false
			} catch (error) {
				console.error(c.bold.red('Failed to generate:'), error)
				running = false
			}
		})
	}

	if (!result) {
		process.exit(1)
	}
}

/**
 * Calculate a current timestamp for files before generation using the filesystem to workaround
 * differences between the current time (as determined by Date.now()) and timestamps that
 * files in the filesystem will receive when created, due to filesystem time resolution
 * differences on different platforms.
 * @param outputPath the output path for the generator
 * @returns a timestamp to use as the timestamp before files are generated
 */
async function currentFilesystemTimestamp(outputPath: string): Promise<number> {
	if (typeof outputPath !== 'string') {
		throw new Error('outputPath must be a string value')
	}
	
	const tempName = `.temp-${Date.now()}`
	const tempPath = path.join(outputPath, tempName)

	await fs.mkdir(outputPath, { recursive: true })
	await fs.writeFile(tempPath, '')
	const stats = await fs.stat(tempPath)
	await fs.unlink(tempPath)
	return stats.mtime.getTime()
}
