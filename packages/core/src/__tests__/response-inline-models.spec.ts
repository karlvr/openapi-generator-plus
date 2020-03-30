import { createTestState } from './common'
import { processDocument } from '../process'

test('inline response model', async() => {
	const state = await createTestState('response-inline-models-v2.yml')
	const result = processDocument(state)

	const group1 = result.groups[0]
	const op1 = group1.operations[0]

	expect(op1.returnType).toEqual('object')
	expect(op1.returnNativeType?.toString()).toEqual('model getTest1_200_response')

	expect(result.models.length).toEqual(1)

	const model1 = result.models[0]
	expect(model1.name).toEqual('model getTest1_200_response')
})
