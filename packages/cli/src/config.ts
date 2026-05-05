import { CommandLineOptions, CommandLineConfig } from './types'
import { promises as fs } from 'fs'
import path from 'path'
import YAML from 'yaml'
import { isURL } from '@openapi-generator-plus/core/dist/utils'
import { filtersFromCommandLine } from './filter'
import { activatePatchesFromCommandLine } from './activate-patches'
import { removeExtensionsFromCommandLine } from './remove-extensions'

function resolveInputPaths(inputPath: string | string[], configDir: string): string | string[] {
	if (Array.isArray(inputPath)) {
		return inputPath.map(p => isURL(p) ? p : path.resolve(configDir, p))
	}
	return isURL(inputPath) ? inputPath : path.resolve(configDir, inputPath)
}

async function loadConfig(path: string): Promise<CommandLineConfig> {
	const configContents = await fs.readFile(path, {
		encoding: 'utf-8',
	}) as string

	if (path.endsWith('.yml') || path.endsWith('.yaml')) {
		return YAML.parse(configContents, {
			prettyErrors: true,
		})
	} else {
		return JSON.parse(configContents)
	}
}

export async function createConfig(commandLineOptions: CommandLineOptions, loadConfigFunction: (path: string) => Promise<CommandLineConfig> = loadConfig): Promise<CommandLineConfig> {
	const configPath = commandLineOptions.config
	let config: CommandLineConfig
	if (configPath) {
		config = await loadConfigFunction(configPath)
		config.configPath = configPath
		if (config.outputPath) {
			config.outputPath = path.resolve(path.dirname(configPath), config.outputPath)
		}
		if (config.inputPath) {
			config.inputPath = resolveInputPaths(config.inputPath, path.dirname(configPath))
		}
		if (commandLineOptions.generator) {
			config.generator = commandLineOptions.generator
		}
		if (commandLineOptions.output) {
			config.outputPath = commandLineOptions.output
		}
		if (commandLineOptions._.length) {
			config.inputPath = commandLineOptions._.length === 1 ? commandLineOptions._[0] : [...commandLineOptions._]
		}
	} else {
		config = {
			generator: commandLineOptions.generator || '',
			outputPath: commandLineOptions.output || '',
			inputPath: commandLineOptions._.length <= 1 ? commandLineOptions._[0] : [...commandLineOptions._],
		}
	}

	const merged = filtersFromCommandLine(commandLineOptions, {
		includeTags: config.includeTags,
		excludeTags: config.excludeTags,
		includePaths: config.includePaths,
		excludePaths: config.excludePaths,
	})
	config.includeTags = merged.includeTags
	config.excludeTags = merged.excludeTags
	config.includePaths = merged.includePaths
	config.excludePaths = merged.excludePaths

	config.activatePatches = activatePatchesFromCommandLine(commandLineOptions, config.activatePatches)
	config.removeExtensions = removeExtensionsFromCommandLine(commandLineOptions, config.removeExtensions)

	return config
}
