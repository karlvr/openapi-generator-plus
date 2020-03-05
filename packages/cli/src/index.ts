import SwaggerParser from 'swagger-parser'
import { OpenAPI } from 'openapi-types'
import { promises as fs } from 'fs'
import { CodegenGenerator, CodegenState, CodegenInitialOptions, processDocument } from '@openapi-generator-plus/core'
import getopts from 'getopts'
import YAML from 'yaml'

import path from 'path'

async function loadCommandLineConfig(path: string): Promise<CodegenInitialOptions> {
	const configContents = await fs.readFile(path, {
		encoding: 'UTF-8',
	}) as string

	if (path.endsWith('.yml') || path.endsWith('.yaml')) {
		return YAML.parse(configContents, {
			prettyErrors: true,
		} as any)
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

	if (commandLineOptions._.length === 0 || !commandLineOptions.output || !commandLineOptions.generator) {
		usage()
		process.exit(1)
	}

	const initialOptions = commandLineOptions.config ? await loadCommandLineConfig(commandLineOptions.config) : {}
	initialOptions.output = commandLineOptions.output

	const parser = new SwaggerParser()
	const apiPath = commandLineOptions._[0]

	let root: OpenAPI.Document
	try {
		root = await parser.parse(apiPath)
	} catch (error) {
		console.error(`Failed to load API specification: ${apiPath} (${error.message})`)
		process.exit(1)
	}

	let generator: CodegenGenerator
	try {
		generator = require(path.resolve(commandLineOptions.generator)).default
	} catch (error) {
		console.error(`Failed to load generator module: ${commandLineOptions.generator} (${error.message})`)
		process.exit(1)
	}

	const state: CodegenState = {
		parser,
		root,
		config: generator,
		options: generator.options(initialOptions),
		anonymousModels: {},
	}

	const doc = processDocument(root, state)

	await generator.exportTemplates(doc, state)
}

run()
