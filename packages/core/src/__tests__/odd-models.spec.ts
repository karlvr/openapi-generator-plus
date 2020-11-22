import { createTestDocument } from './common'
import { idx } from '../'

test('array of strings with collection models', async() => {
	const result = await createTestDocument('odd-models/array-of-strings-v2.yml', {
		collectionModelsAllowed: true,
	})

	const models = idx.allValues(result.models)
	const model1 = models[0]
	expect(model1.name).toEqual('ArrayOfStrings')
	expect(model1.nativeType.toString()).toEqual('ArrayOfStrings')
	expect(model1.parent).toBeNull()
	expect(model1.parentNativeType).not.toBeNull()
	expect(model1.parentNativeType?.toString()).toEqual('array string')
})

test('array of strings without collection models', async() => {
	const result = await createTestDocument('odd-models/array-of-strings-v2.yml')

	const models = idx.allValues(result.models)
	expect(models.length).toEqual(0)

	const response = result.groups[0].operations[0].defaultResponse
	expect(response).not.toBeNull()

	const nativeType = response!.nativeType
	expect(nativeType).not.toBeNull()
	expect(nativeType!.toString()).toEqual('array string')
})

test('uuid', async() => {
	const result = await createTestDocument('odd-models/uuid-v2.yml')

	/* We don't parse the UUID type as a model */
	expect(idx.size(result.models)).toEqual(0)

	/* Note that there doesn't seem to be a way to _use_ schemas like this actually */
})
