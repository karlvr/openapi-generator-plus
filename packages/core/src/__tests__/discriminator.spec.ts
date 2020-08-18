import { createTestDocument } from './common'
import * as idx from '../indexed-type'
import util from 'util'

test('one of discriminator', async() => {
	const result = await createTestDocument('discriminator/one-of-discriminator.yml')

	const models = idx.allValues(result.models)
	const model1 = models[0]
	const model4 = models[3]

	expect(model1.name).toEqual('Cat')
	expect(idx.size(model1.implements!)).toBe(1)
	expect(model4.name).toEqual('MyResponseType')
	expect(model4.discriminator!.name).toEqual('petType')
	expect(model4.discriminator!.references.length).toEqual(3)
	expect(model4.children).toBeUndefined()
	expect(model4.isInterface).toBe(true)
})

test('one of no discriminator', async() => {
	const result = await createTestDocument('discriminator/one-of-no-discriminator.yml')

	const models = idx.allValues(result.models)
	const combinedModel = models[3]
	expect(combinedModel.name).toEqual('MyResponseType')
	expect(combinedModel.isInterface).toBeFalsy()

	const combinedModelProperties = idx.allValues(combinedModel.properties!)
	expect(combinedModelProperties![0].name).toEqual('name')
	expect(combinedModelProperties![1].name).toEqual('bark')
	expect(combinedModelProperties![2].name).toEqual('lovesRocks')

	const model1 = models[0]
	expect(model1.isInterface).toBe(true)
})

test('one of discriminator missing property', async() => {
	await expect(createTestDocument('discriminator/one-of-discriminator-missing-property.yml'))
		.rejects.toThrow('Discriminator property "petType" for "MyResponseType" missing from "Cat"')
})

test('all of subclasses discriminator', async() => {
	const result = await createTestDocument('discriminator/all-of-subclasses-discriminator.yml')

	const models = idx.allValues(result.models)
	const model1 = models[0]
	const model4 = models[3]

	expect(model1.name).toEqual('Cat')
	expect(model4.name).toEqual('Pet')
	expect(idx.size(model4.children!)).toEqual(3)
	expect(model4.discriminator!.references.length).toEqual(3)
	expect(model4.isInterface).toBeFalsy()
})

test('all of subclasses discriminator no properties', async() => {
	const result = await createTestDocument('discriminator/all-of-subclasses-discriminator-no-properties.yml')

	const models = idx.allValues(result.models)
	const model1 = models[0]
	const model4 = models[3]

	expect(model1.name).toEqual('Cat')
	expect(model4.name).toEqual('Pet')
	expect(idx.size(model4.children!)).toEqual(3)
	expect(model4.discriminator!.references.length).toEqual(3)
	expect(model4.isInterface).toBeFalsy()
})

test('one of all of discriminator', async() => {
	const result = await createTestDocument('discriminator/one-of-all-of-discriminator.yml')
	expect(result).toBeDefined()
	// console.log(util.inspect(result, { depth: 5 }))

	const cat = idx.get(result.models, 'Cat')
	expect(cat).toBeDefined()

	expect(cat?.implements).toBeDefined()
	expect(idx.size(cat?.implements!)).toEqual(1)
})

/**
 * Schema using all-of with a discriminator, where one of the uses is not a subclass.
 */
test('all of discriminator without superclass', async() => {
	const result = await createTestDocument('discriminator/all-of-discriminator-without-superclass.yml')
	expect(result).toBeDefined()
	// console.log(util.inspect(result, { depth: null }))

	const base = idx.get(result.models, 'Base')!
	expect(base).toBeDefined()
	expect(base.discriminator).toBeDefined()
	expect(base.discriminator!.references.length).toEqual(2)
	
	const a = idx.get(result.models, 'A')!
	expect(a).toBeDefined()
	expect(a.parent).not.toBeDefined()

	const b = idx.get(result.models, 'B')!
	expect(b).toBeDefined()
	expect(b.parent).toBeDefined()

	expect(a.discriminator).not.toBeDefined()
	expect(a.discriminatorValues).toBeDefined()
	expect(b.discriminator).not.toBeDefined()
	expect(b.discriminatorValues).toBeDefined()
})
