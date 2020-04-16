import { createTestDocument } from './common'
import * as idx from '../indexed-type'

test('inline response model', async() => {
	const result = await createTestDocument('parameter-inline-models-v2.yml')

	const group1 = result.groups[0]
	const op1 = group1.operations[0]

	expect(idx.size(op1.parameters!)).toEqual(1)

	const params = idx.allValues(op1.parameters!)

	const param1 = params[0]
	expect(param1.name).toEqual('arg1')
	expect(param1.nativeType.toString()).toEqual('getTest1_arg1_enum')

	expect(idx.size(result.models)).toEqual(1)

	const models = idx.allValues(result.models)
	const model1 = models[0]
	expect(model1.name).toEqual('getTest1_arg1_enum')
})
