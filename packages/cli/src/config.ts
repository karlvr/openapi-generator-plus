import { CommandLineOptions, CommandLineConfig } from './types'
import { promises as fs } from 'fs'
import path from 'path'
import YAML from 'yaml'
import { isURL } from '@openapi-generator-plus/core/dist/utils'

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
	if (configPath) {
		const config = await loadConfigFunction(configPath)
		config.configPath = configPath
		if (config.outputPath) {
			config.outputPath = path.resolve(path.dirname(configPath), config.outputPath)
		}
		if (config.inputPath && !isURL(config.inputPath)) {
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
		return config
	} else {
		return {
			generator: commandLineOptions.generator || '',
			outputPath: commandLineOptions.output || '',
			inputPath: commandLineOptions._[0],
		}
	}
}
