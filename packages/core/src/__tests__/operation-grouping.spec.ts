import { createTestDocument } from './common'
import { addToGroupsByTagOrPath } from '../operation-grouping'

test('simple', async() => {
	const result = await createTestDocument('operation-grouping/simple-v3.yml', {
		operationGroupingStrategy: addToGroupsByTagOrPath,
	})

	expect(result.groups.length).toEqual(1)
	const group1 = result.groups[0]
	expect(group1.name).toEqual('test1')
	expect(group1.path).toEqual('/test1')

	expect(group1.operations.length).toBe(2)
	expect(group1.operations[0].path).toBe('/a')
	expect(group1.operations[1].path).toBe('/b')
})

test('tags and paths', async() => {
	const result = await createTestDocument('operation-grouping/tags-and-paths-v3.yml', {
		operationGroupingStrategy: addToGroupsByTagOrPath,
	})

	expect(result.groups.length).toEqual(1)
	const group1 = result.groups[0]
	expect(group1.name).toEqual('test1')
	expect(group1.path).toEqual('/test1')

	expect(group1.operations.length).toBe(2)
	expect(group1.operations[0].path).toBe('/a')
	expect(group1.operations[1].path).toBe('/b')
})
