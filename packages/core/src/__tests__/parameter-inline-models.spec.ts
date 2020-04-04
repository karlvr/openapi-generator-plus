import { createTestDocument } from './common'

test('inline response model', async() => {
	const result = await createTestDocument('parameter-inline-models-v2.yml')

	const group1 = result.groups[0]
	const op1 = group1.operations[0]

	expect(op1.allParams!.length).toEqual(1)

	const param1 = op1.allParams![0]
	expect(param1.name).toEqual('arg1')
	expect(param1.nativeType.toString()).toEqual('getTest1_arg1_enum')

	expect(result.models.length).toEqual(1)

	const model1 = result.models[0]
	expect(model1.name).toEqual('getTest1_arg1_enum')
})
