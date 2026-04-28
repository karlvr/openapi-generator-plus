import YAML from 'yaml'
import { promises as fs } from 'fs'
import path from 'path'
import { activateExtensionsInOpenAPISpec, bundleCodegenInput, filterOpenAPISpec, mergeOpenAPISpecs, removeExtensionsFromOpenAPISpec } from '@openapi-generator-plus/core'
import getopts from 'getopts'
import { CommandLineOptions } from './types'
import { createConfig } from './config'
import { usage } from './usage'
import { FILTER_STRING_OPTIONS, hasAnyFilter } from './filter'
import { ACTIVATE_EXTENSION_STRING_OPTIONS } from './activate-extensions'
import { REMOVE_EXTENSION_STRING_OPTIONS } from './remove-extensions'

export default async function bundleCommand(argv: string[]): Promise<void> {
	const commandLineOptions: CommandLineOptions = getopts(argv, {
		alias: {
			config: 'c',
			output: 'o',
		},
		string: [...FILTER_STRING_OPTIONS, ...ACTIVATE_EXTENSION_STRING_OPTIONS, ...REMOVE_EXTENSION_STRING_OPTIONS],
		unknown: (option) => {
			console.log(`Unknown option: ${option}`)
			return false
		},
	})

	let config
	try {
		config = await createConfig(commandLineOptions)
	} catch (error) {
		console.error(`Failed to open config file: ${error}`)
		process.exit(1)
	}

	const inputPaths = !config.inputPath
		? []
		: Array.isArray(config.inputPath) ? config.inputPath : [config.inputPath]

	if (inputPaths.length === 0) {
		console.log('Input path not specified')
		usage()
		process.exit(1)
	}

	const docs = await Promise.all(inputPaths.map(p => bundleCodegenInput(p)))

	let doc = docs.length === 1
		? docs[0]
		: mergeOpenAPISpecs(docs, {
			onCollision: ({ kind, key }) => {
				console.warn(`Warning: collision while merging ${kind}: ${key} (last input wins)`)
			},
		})

	if (config.activateExtensions && config.activateExtensions.length) {
		doc = activateExtensionsInOpenAPISpec(doc, config.activateExtensions)
	}

	if (config.removeExtensions && config.removeExtensions.length) {
		doc = removeExtensionsFromOpenAPISpec(doc, config.removeExtensions)
	}

	const filters = {
		includeTags: config.includeTags,
		excludeTags: config.excludeTags,
		includePaths: config.includePaths,
		excludePaths: config.excludePaths,
	}
	if (hasAnyFilter(filters)) {
		doc = filterOpenAPISpec(doc, filters)
	}

	const outputPath = await resolveOutputPath(config.outputPath, inputPaths)

	if (outputPath) {
		await fs.mkdir(path.dirname(outputPath), { recursive: true })
		if (outputPath.endsWith('.json')) {
			const json = JSON.stringify(doc, undefined, 2)
			await fs.writeFile(outputPath, json)
		} else {
			const yaml = YAML.stringify(doc)
			await fs.writeFile(outputPath, yaml)
		}
	} else {
		const yaml = YAML.stringify(doc)
		console.log(yaml)
	}
}

/**
 * Resolve the final output file path. If outputPath is a directory (or ends with a path
 * separator), write into it using the basename of the first input. Otherwise treat
 * outputPath as the file path itself.
 */
async function resolveOutputPath(outputPath: string | undefined, inputPaths: string[]): Promise<string | undefined> {
	if (!outputPath) {
		return undefined
	}

	const looksLikeDir = outputPath.endsWith(path.sep) || outputPath.endsWith('/') || await isDirectory(outputPath)
	if (!looksLikeDir) {
		return outputPath
	}

	const firstInput = inputPaths[0]
	const inputName = path.basename(firstInput.split('?')[0].split('#')[0]) || 'bundle.yaml'
	return path.join(outputPath, inputName)
}

async function isDirectory(p: string): Promise<boolean> {
	try {
		const stats = await fs.stat(p)
		return stats.isDirectory()
	} catch {
		return false
	}
}
