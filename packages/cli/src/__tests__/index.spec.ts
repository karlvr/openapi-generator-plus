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

test('activate-extension repeated and comma-separated', async() => {
	const config = await createConfig({ _: ['input'], 'activate-extension': ['a,b', 'c'] }, async() => ({ outputPath: '', inputPath: '', generator: '' }))
	expect(config.activateExtensions).toEqual(['a', 'b', 'c'])
})

test('activate-extension empty string from getopts is ignored', async() => {
	const config = await createConfig({ _: ['input'], 'activate-extension': '' }, async() => ({ outputPath: '', inputPath: '', generator: '' }))
	expect(config.activateExtensions).toBeUndefined()
})

test('activate-extension falls back to config file value when CLI omits it', async() => {
	const config = await createConfig({ _: [], config: '/' }, async() => ({ outputPath: 'o', inputPath: 'i', generator: 'g', activateExtensions: ['server'] }))
	expect(config.activateExtensions).toEqual(['server'])
})

test('activate-extension CLI overrides config file value', async() => {
	const config = await createConfig({ _: [], config: '/', 'activate-extension': 'client' }, async() => ({ outputPath: 'o', inputPath: 'i', generator: 'g', activateExtensions: ['server'] }))
	expect(config.activateExtensions).toEqual(['client'])
})

/* Note that the test generator doesn't actually generate files, but we still get to test the functionality of the CLI app */
describe('generate', () => {
	const basePath = path.join(__dirname, 'specs')
	const files = fs.readdirSync(basePath)

	for (const file of files) {
		test(`Generate spec: ${file}`, async() => {
			const outputPath = path.join(tmpdir(), 'openapi-generator-plus', 'cli')
			fs.mkdirSync(outputPath, { recursive: true })

			await generateCommand([
				'-o', path.join(outputPath, file),
				'-g', '@openapi-generator-plus/test-generator',
				'--clean',
				path.join(basePath, file),
			])
			expect(true).toBe(true)
		})
	}
})
