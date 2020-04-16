import { createTestDocument } from './common'
import * as idx from '../indexed-type'

test('inline model name conflict', async() => {
	const result = await createTestDocument('inline-model-name-conflict-v2.yml')

	const group1 = result.groups[0]
	const op1 = group1.operations[0]

	expect(op1.returnType).toEqual('object')
	expect(op1.returnNativeType?.toString()).toEqual('getTest1_200_response_model1')

	expect(idx.size(result.models)).toEqual(2)

	const models = idx.values(result.models)
	const model1 = models[0]
	expect(model1.name).toEqual('getTest1_200_response_model')
	const model1Properties = idx.values(model1.properties!)
	expect(model1Properties[0].name).toEqual('prop2')
})
