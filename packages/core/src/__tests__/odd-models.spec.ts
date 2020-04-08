import { createTestDocument } from './common'

test('array of strings', async() => {
	const result = await createTestDocument('odd-models/array-of-strings-v2.yml', {
		collectionModelsAllowed: true,
	})

	const model1 = result.models[0]
	expect(model1.name).toEqual('ArrayOfStrings')
	expect(model1.nativeType.toString()).toEqual('ArrayOfStrings')
	expect(model1.parent).toBeUndefined()
	expect(model1.parentNativeType).not.toBeUndefined()
	expect(model1.parentNativeType?.toString()).toEqual('array string')
})

test('uuid', async() => {
	const result = await createTestDocument('odd-models/uuid-v2.yml')

	/* We don't parse the UUID type as a model */
	expect(result.models.length).toEqual(0)

	/* Note that there doesn't seem to be a way to _use_ schemas like this actually */
})
