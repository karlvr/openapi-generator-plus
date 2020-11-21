import { createTestDocument } from './common'
import { CodegenSchemaType } from '@openapi-generator-plus/types'
import { idx } from '../'

test('string map', async() => {
	const result = await createTestDocument('maps/string-map-v2.yml')

	expect(idx.size(result.models)).toEqual(1)

	const models = idx.allValues(result.models)
	const model1 = models[0]
	expect(model1.name).toEqual('model1')
	expect(idx.size(model1.properties!)).toEqual(1)
	const model1Properties = idx.allValues(model1.properties!)
	expect(model1Properties![0].schemaType).toEqual(CodegenSchemaType.MAP)
})

test('object map', async() => {
	const result = await createTestDocument('maps/object-map-v2.yml')

	expect(idx.size(result.models)).toEqual(2)

	const models = idx.allValues(result.models)
	const model1 = models[0]
	expect(model1.name).toEqual('model1')
	expect(idx.size(model1.properties!)).toEqual(1)

	const model1Properties = idx.allValues(model1.properties!)
	const prop1 = model1Properties![0]
	expect(prop1.schemaType).toEqual(CodegenSchemaType.MAP)
	expect(prop1.nativeType.toString()).toEqual('map model2')
	
	expect(model1.models).toBeUndefined()
})

/**
 * Tests that the generator works when we don't allow collection classes to be model parents.
 */
test('object map with no map parents', async() => {
	const result = await createTestDocument('maps/object-map-v2.yml')

	expect(idx.size(result.models)).toEqual(2)

	const models = idx.allValues(result.models)
	const model1 = models[0]
	expect(model1.name).toEqual('model1')
	expect(idx.size(model1.properties!)).toEqual(1)

	const model1Properties = idx.allValues(model1.properties!)
	const prop1 = model1Properties![0]
	expect(prop1.schemaType).toEqual(CodegenSchemaType.MAP)
	expect(prop1.nativeType.toString()).toEqual('map model2')
	
	expect(model1.models).toBeUndefined()
})
