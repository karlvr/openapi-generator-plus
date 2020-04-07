import { createTestDocument } from './common'
import { CodegenPropertyType } from '@openapi-generator-plus/types'

test('string map', async() => {
	const result = await createTestDocument('maps/string-map-v2.yml')

	expect(result.models.length).toEqual(1)

	const model1 = result.models[0]
	expect(model1.name).toEqual('model1')
	expect(model1.properties?.length).toEqual(1)
	expect(model1.properties![0].propertyType).toEqual(CodegenPropertyType.MAP)
})

test('object map', async() => {
	const result = await createTestDocument('maps/object-map-v2.yml')

	expect(result.models.length).toEqual(2)

	const model1 = result.models[0]
	expect(model1.name).toEqual('model1')
	expect(model1.properties?.length).toEqual(1)

	const prop1 = model1.properties![0]
	expect(prop1.propertyType).toEqual(CodegenPropertyType.MAP)
	expect(prop1.nativeType.toString()).toEqual('map model2')
	
	expect(model1.models).toBeUndefined()
})

/**
 * Tests that the generator works when we don't allow collection classes to be model parents.
 */
test('object map with no map parents', async() => {
	const result = await createTestDocument('maps/object-map-v2.yml', {
		collectionParentNotAllowed: true,
	})

	expect(result.models.length).toEqual(2)

	const model1 = result.models[0]
	expect(model1.name).toEqual('model1')
	expect(model1.properties?.length).toEqual(1)

	const prop1 = model1.properties![0]
	expect(prop1.propertyType).toEqual(CodegenPropertyType.MAP)
	expect(prop1.nativeType.toString()).toEqual('map model2')
	
	expect(model1.models).toBeUndefined()
})
