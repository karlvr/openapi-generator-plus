import { createTestDocument } from './common'
import { idx } from '../'

test('array model', async() => {
	const result = await createTestDocument('collection-models/array-model-v3.yml')

	const group1 = result.groups[0]
	const op1 = group1.operations[0]

	expect(op1.returnType).toBeNull()
	expect(idx.size(op1.queryParams!)).toEqual(1)
	
	const queryParams = idx.allValues(op1.queryParams!)
	const queryParam1 = queryParams[0]
	expect(queryParam1.name).toEqual('statuses')
	expect(queryParam1.nativeType.toString()).toEqual('array Status_enum')
})

test('map model', async() => {
	const result = await createTestDocument('collection-models/map-model-v3.yml')

	const group1 = result.groups[0]
	const op1 = group1.operations[0]

	expect(op1.returnType).toBeNull()
	expect(idx.size(op1.queryParams!)).toEqual(1)

	const queryParams = idx.allValues(op1.queryParams!)
	const queryParam1 = queryParams[0]
	expect(queryParam1.name).toEqual('statuses')
	expect(queryParam1.nativeType.toString()).toEqual('map Status_model')
})
