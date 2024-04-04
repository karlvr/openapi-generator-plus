import { createTestDocument } from './common'
import { idx } from '..'

test('inline response model', async() => {
	const result = await createTestDocument('responses/response-inline-models-v2.yml')

	const group1 = result.groups[0]
	const op1 = group1.operations[0]

	expect(op1.returnNativeType?.toString()).toEqual('getTest1_200_response_model')

	expect(idx.size(result.schemas)).toEqual(1)

	const models = idx.allValues(result.schemas)
	const model1 = models[0]
	expect(model1.name).toEqual('getTest1_200_response_model')
})

test('wildcard mimetyoe', async() => {
	const result = await createTestDocument('responses/wildcard-mimetype.yml')
	const group1 = result.groups[0]
	const op1 = group1.operations[0]

	expect(op1).toBeTruthy()
	expect(op1.produces).toEqual([{ encoding: null, mediaType: 'image/*', mimeType: 'image/*', wildcard: true }])
})
