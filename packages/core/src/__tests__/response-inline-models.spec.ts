import { createTestDocument } from './common'

test('inline response model', async() => {
	const result = await createTestDocument('response-inline-models-v2.yml')

	const group1 = result.groups[0]
	const op1 = group1.operations[0]

	expect(op1.returnType).toEqual('object')
	expect(op1.returnNativeType?.toString()).toEqual('getTest1_200_response_model')

	expect(result.models.length).toEqual(1)

	const model1 = result.models[0]
	expect(model1.name).toEqual('getTest1_200_response_model')
})
