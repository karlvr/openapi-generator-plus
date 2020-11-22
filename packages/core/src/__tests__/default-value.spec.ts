import { createTestDocument } from './common'
import { CodegenSchemaType } from '@openapi-generator-plus/types'
import { idx } from '../'

test('array property', async() => {
	const result = await createTestDocument('default-value/arrays-v3.yml')

	expect(idx.size(result.models)).toEqual(1)

	const models = idx.allValues(result.models)
	const model1 = models[0]
	expect(model1.name).toEqual('Test')
	expect(idx.size(model1.properties!)).toEqual(2)

	const model1Properties = idx.allValues(model1.properties!)
	const prop1 = model1Properties[0]
	expect(prop1.name).toBe('arrayProperty')
	expect(prop1.schemaType).toEqual(CodegenSchemaType.ARRAY)
	expect(prop1.initialValue).toEqual({ value: [], literalValue: '[]' })

	const prop2 = model1Properties[1]
	expect(prop2.name).toBe('notRequiredArrayProperty')
	expect(prop2.schemaType).toEqual(CodegenSchemaType.ARRAY)
	expect(prop2.initialValue).toEqual({ literalValue: 'undefined' })

})
