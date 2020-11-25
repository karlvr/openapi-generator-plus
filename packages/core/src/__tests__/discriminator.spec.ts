import { createTestDocument } from './common'
import { idx } from '../'
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
	expect(model4.children).toBeNull()
	expect(model4.isInterface).toBe(true)
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

	expect(cat?.implements).not.toBeNull()
	expect(idx.size(cat!.implements!)).toEqual(1)
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
	expect(base.discriminator).not.toBeNull()
	expect(base.discriminator!.references.length).toEqual(2)
	
	const a = idx.get(result.models, 'A')!
	expect(a).toBeDefined()
	expect(a.parent).toBeNull()

	const b = idx.get(result.models, 'B')!
	expect(b).toBeDefined()
	expect(b.parent).not.toBeNull()

	expect(a.discriminator).toBeNull()
	expect(a.discriminatorValues).not.toBeNull()
	expect(b.discriminator).toBeNull()
	expect(b.discriminatorValues).not.toBeNull()
})
