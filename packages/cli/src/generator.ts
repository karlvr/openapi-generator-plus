import { defaultGeneratorOptions, CodegenConfig, CodegenGenerator, CodegenGeneratorConstructor, CodegenOptions } from '@openapi-generator-plus/core'
import path from 'path'
import { promises as fs } from 'fs'

async function loadGenerator<O extends CodegenOptions>(name: string): Promise<CodegenGeneratorConstructor<O> | CodegenGenerator<O>> {
	const generatorPath = path.resolve(name)
	try {
		/* First try as a local file */
		await fs.access(generatorPath)
		return require(generatorPath).default
	} catch (error) {
		/* Resolve generator as a local module */
		const resolved = require.resolve(name, { paths: ['.'] })
		return require(resolved).default
	}
}

export async function createGenerator<O extends CodegenOptions>(config: CodegenConfig): Promise<CodegenGenerator<O>> {
	const generatorConstructor = await loadGenerator<O>(config.generator)
	if (typeof generatorConstructor === 'object') {
		return generatorConstructor
	} else if (typeof generatorConstructor === 'function') {
		const options = defaultGeneratorOptions()
		return generatorConstructor(options)
	} else {
		throw new Error(`Unexpected result when loading generator module "${config.generator}. Not an object or a function.`)
	}
}
