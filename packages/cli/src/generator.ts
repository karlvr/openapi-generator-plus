import { CodegenGeneratorConstructor } from '@openapi-generator-plus/types'
import path from 'path'
import { promises as fs } from 'fs'

export async function loadGeneratorConstructor(name: string): Promise<CodegenGeneratorConstructor<unknown>> {
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
