import { createTestDocument } from './common'
import { addToGroupsByTagOrPath } from '../operation-grouping'

test('simple', async() => {
	const result = await createTestDocument('operation-grouping/simple-v3.yml', {
		operationGroupingStrategy: addToGroupsByTagOrPath,
	})

	expect(result.groups.length).toEqual(1)
	const group1 = result.groups[0]
	expect(group1.name).toEqual('test1 api')
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
	expect(group1.name).toEqual('test1 api')
	expect(group1.path).toEqual('/test1')

	expect(group1.operations.length).toBe(2)
	expect(group1.operations[0].path).toBe('/a')
	expect(group1.operations[1].path).toBe('/b')
})

test('duplicate operation ids', async() => {
	const result = await createTestDocument('operation-grouping/duplicate-operation-ids.yml', {
		operationGroupingStrategy: addToGroupsByTagOrPath,
	})

	expect(result.groups.length).toEqual(1)
	const group1 = result.groups[0]
	expect(group1.operations.length).toBe(3)
	expect(group1.operations[0].name).toBe('GET /a operation')
	expect(group1.operations[1].name).toBe('GET /b operation')
	expect(group1.operations[2].name).toBe('uniqueOperation')
})
