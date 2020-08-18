import { createTestDocument } from './common'
import * as idx from '../indexed-type'

test('one of discriminator', async() => {
	const result = await createTestDocument('one-of/one-of-discriminator.yml')

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
	const result = await createTestDocument('one-of/one-of-no-discriminator.yml')

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
	await expect(createTestDocument('one-of/one-of-discriminator-missing-property.yml'))
		.rejects.toThrow('Discriminator property "petType" for "MyResponseType" missing from "Cat"')
})

test('one of subclasses discriminator', async() => {
	const result = await createTestDocument('one-of/one-of-subclasses-discriminator.yml')

	const models = idx.allValues(result.models)
	const model1 = models[0]
	const model4 = models[3]

	expect(model1.name).toEqual('Cat')
	expect(model4.name).toEqual('Pet')
	expect(idx.size(model4.children!)).toEqual(3)
	expect(model4.discriminator!.references.length).toEqual(3)
	expect(model4.isInterface).toBeFalsy()
})

test('one of subclasses discriminator no properties', async() => {
	const result = await createTestDocument('one-of/one-of-subclasses-discriminator-no-properties.yml')

	const models = idx.allValues(result.models)
	const model1 = models[0]
	const model4 = models[3]

	expect(model1.name).toEqual('Cat')
	expect(model4.name).toEqual('Pet')
	expect(idx.size(model4.children!)).toEqual(3)
	expect(model4.discriminator!.references.length).toEqual(3)
	expect(model4.isInterface).toBeFalsy()
})
