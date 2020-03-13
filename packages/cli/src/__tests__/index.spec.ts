import { createConfig } from '../config'

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
