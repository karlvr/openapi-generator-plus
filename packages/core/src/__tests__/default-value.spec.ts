import { createTestDocument } from './common'
import { CodegenPropertyType } from '@openapi-generator-plus/types'

test('array property', async() => {
	const result = await createTestDocument('default-value/arrays-v3.yml')

	expect(result.models.length).toEqual(1)

	const model1 = result.models[0]
	expect(model1.name).toEqual('Test')
	expect(model1.properties?.length).toEqual(2)

	const prop1 = model1.properties![0]
	expect(prop1.name).toBe('arrayProperty')
	expect(prop1.propertyType).toEqual(CodegenPropertyType.ARRAY)
	expect(prop1.defaultValue).toEqual({ value: [], literalValue: '[]' })

	const prop2 = model1.properties![1]
	expect(prop2.name).toBe('notRequiredArrayProperty')
	expect(prop2.propertyType).toEqual(CodegenPropertyType.ARRAY)
	expect(prop2.defaultValue).toEqual({ literalValue: 'undefined' })

})
