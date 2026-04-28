import YAML from 'yaml'
import { promises as fs } from 'fs'
import { activateExtensionsInOpenAPISpec, bundleCodegenInput, filterOpenAPISpec, mergeOpenAPISpecs } from '@openapi-generator-plus/core'
import getopts from 'getopts'
import { CommandLineOptions } from './types'
import { usage } from './usage'
import { FILTER_STRING_OPTIONS, filtersFromCommandLine, hasAnyFilter } from './filter'
import { ACTIVATE_EXTENSION_STRING_OPTIONS, activateExtensionsFromCommandLine } from './activate-extensions'

export default async function bundleCommand(argv: string[]): Promise<void> {
	const commandLineOptions: CommandLineOptions = getopts(argv, {
		alias: {
			output: 'o',
		},
		string: [...FILTER_STRING_OPTIONS, ...ACTIVATE_EXTENSION_STRING_OPTIONS],
		unknown: (option) => {
			console.log(`Unknown option: ${option}`)
			return false
		},
	})

	const outputPath = commandLineOptions.output
	const inputPaths = commandLineOptions._

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

	const activations = activateExtensionsFromCommandLine(commandLineOptions)
	if (activations && activations.length) {
		doc = activateExtensionsInOpenAPISpec(doc, activations)
	}

	const filters = filtersFromCommandLine(commandLineOptions)
	if (hasAnyFilter(filters)) {
		doc = filterOpenAPISpec(doc, filters)
	}

	if (outputPath) {
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
