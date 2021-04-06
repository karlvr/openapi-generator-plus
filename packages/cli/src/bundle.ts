import YAML from 'yaml'
import { promises as fs } from 'fs'
import { bundleCodegenInput } from '@openapi-generator-plus/core'
import getopts from 'getopts'
import { CommandLineOptions } from './types'
import { usage } from './usage'

export default async function bundleCommand(argv: string[]): Promise<void> {
	const commandLineOptions: CommandLineOptions = getopts(argv, {
		alias: {
			output: 'o',
		},
		unknown: (option) => {
			console.log(`Unknown option: ${option}`)
			return false
		},
	})

	const outputPath = commandLineOptions.output
	const inputPath = commandLineOptions._[0]

	if (!inputPath) {
		console.log('Input path not specified')
		usage()
		process.exit(1)
	}

	const doc = await bundleCodegenInput(inputPath)

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
