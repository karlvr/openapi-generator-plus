import fs from 'fs'
import path from 'path'
import { tmpdir } from 'os'
import { createConfig } from '../config'
import generateCommand from '../generate'

test('no config specified', async() => {
	const config = await createConfig({ _: [] }, async() => ({ outputPath: 'test output', inputPath: 'test input', generator: 'test generator' }))
	expect(config.inputPath).toBeFalsy()
	expect(config.outputPath).toBeFalsy()
	expect(config.generator).toBeFalsy()
})

test('config and relative paths', async() => {
	const config = await createConfig({ _: [], config: '/' }, async() => ({ outputPath: 'test output', inputPath: 'test input', generator: 'test generator' }))
	expect(config.inputPath).toEqual('/test input')
	expect(config.outputPath).toEqual('/test output')
	expect(config.generator).toEqual('test generator')
})

test('config with overrides', async() => {
	const config = await createConfig({ _: ['input'], config: '/', output: 'output', generator: 'generator' }, async() => ({ outputPath: 'test output', inputPath: 'test input', generator: 'test generator' }))
	expect(config.inputPath).toEqual('input')
	expect(config.outputPath).toEqual('output')
	expect(config.generator).toEqual('generator')
})

/* Note that the test generator doesn't actually generate files, but we still get to test the functionality of the CLI app */
describe('generate', () => {
	const basePath = path.join(__dirname, 'specs')
	const files = fs.readdirSync(basePath)

	for (const file of files) {
		test(file, async() => {
			const outputPath = path.join(tmpdir(), 'openapi-generator-plus', 'cli')
			fs.mkdirSync(outputPath, { recursive: true })

			await generateCommand([
				'-o', path.join(outputPath, file),
				'-g', '@openapi-generator-plus/test-generator',
				'--clean',
				path.join(basePath, file),
			])
		})
	}
})
