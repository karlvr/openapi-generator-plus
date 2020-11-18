import { createTestDocument } from './common'
import { idx } from '../'

test('one of no discriminator', async() => {
	const result = await createTestDocument('no-discriminator/one-of-no-discriminator.yml')

	const combinedModel = idx.find(result.models, m => m.name === 'MyResponseType')
	expect(combinedModel).toBeDefined()
	expect(combinedModel!.isInterface).toBeTruthy()

	/* The combined model has no properties, as it implements the parent interfaces */
	const combinedModelProperties = idx.allValues(combinedModel!.properties!)
	expect(combinedModelProperties.length).toEqual(0)

	const model1 = idx.find(result.models, m => m.name === 'Cat')
	expect(model1!.isInterface).toBeFalsy()
	expect(model1!.implements!['MyResponseType']).toBeTruthy()
})

test('one of no discriminator need interface', async() => {
	const result = await createTestDocument('no-discriminator/one-of-no-discriminator-needs-interfaces.yml')

	const someObject = idx.find(result.models, m => m.name === 'SomeObject')
	expect(someObject).toBeDefined()
	expect(someObject!.isInterface).toBeFalsy()

	const submodels = idx.allValues(someObject!.models!)
	expect(submodels.length).toEqual(1)
	expect(submodels[0].isInterface).toBeTruthy()
})
