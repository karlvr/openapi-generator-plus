import SwaggerParser from 'swagger-parser'
import { promises as fs } from 'fs'
import { CodegenConfig, CodegenState, CodegenInitialOptions, processDocument } from '@openapi-generator-plus/core'
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
	try {
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
		const root = await parser.parse(commandLineOptions._[0])
		const config: CodegenConfig = require(path.resolve(commandLineOptions.generator)).default

		const state: CodegenState = {
			parser,
			root,
			config,
			options: config.options(initialOptions),
			anonymousModels: {},
		}

		// console.log('refs', parser.$refs)
		// return
		
		// console.log(JSON.stringify(api, null, 2))

		const doc = processDocument(root, state)

		await config.exportTemplates(doc, state)
	} catch (error) {
		console.error('API validation failed', error)
	}
}

run()
