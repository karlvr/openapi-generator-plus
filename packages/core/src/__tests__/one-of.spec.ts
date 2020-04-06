import { createTestDocument } from './common'

test('one of discriminator', async() => {
	const result = await createTestDocument('one-of/one-of-discriminator.yml')

	const model1 = result.models[0]
	const model4 = result.models[3]

	expect(model1.name).toEqual('Cat')
	expect(model4.name).toEqual('MyResponseType')
	expect(model4.discriminator!.name).toEqual('petType')
	expect(model4.discriminator!.references.length).toEqual(3)
	expect(model4.children).toBeUndefined()
})

test('one of no discriminator', async() => {
	const result = await createTestDocument('one-of/one-of-no-discriminator.yml')

	const combinedModel = result.models[3]
	expect(combinedModel.name).toEqual('MyResponseType')
	expect(combinedModel.properties![0].name).toEqual('name')
	expect(combinedModel.properties![1].name).toEqual('bark')
	expect(combinedModel.properties![2].name).toEqual('lovesRocks')
})

test('one of discriminator missing property', async() => {
	await expect(createTestDocument('one-of/one-of-discriminator-missing-property.yml'))
		.rejects.toThrow('Discriminator property "petType" for "MyResponseType" missing from "Cat"')
})

test('one of subclasses discriminator', async() => {
	const result = await createTestDocument('one-of/one-of-subclasses-discriminator.yml')

	const model1 = result.models[0]
	const model4 = result.models[3]

	expect(model1.name).toEqual('Cat')
	expect(model4.name).toEqual('Pet')
	expect(model4.children?.length).toEqual(3)
	expect(model4.discriminator!.references.length).toEqual(3)
})
