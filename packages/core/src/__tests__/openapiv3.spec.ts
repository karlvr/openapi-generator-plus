import { createTestDocument, createTestResult } from './common'
import { idx } from '../'

test('process document', async() => {
	const result = await createTestDocument('openapiv3/simple.yml')
	expect(result).toBeDefined()
})

test('parse info', async() => {
	const result = await createTestDocument('openapiv3/simple.yml')

	expect(result.info.description).toEqual('Lorem ipsum')
	expect(result.info.version).toEqual('1.0.1')
	expect(result.info.title).toEqual('Example')
	expect(result.servers).not.toBeNull()
	expect(result.servers![0].url).toEqual('http://example.com/api/v1')
	expect(result.servers![1].url).toEqual('https://example.com/api/v1')
})

test('parse operation params', async() => {
	const result = await createTestDocument('openapiv3/simple.yml')

	const group1 = result.groups[0]
	const op1 = group1.operations[0]
	expect(op1.name).toEqual('getTest1')
	expect(op1.parameters).not.toBeNull()
	expect(idx.size(op1.parameters!)).toEqual(2)
})

test('parse operation body params', async() => {
	const result = await createTestDocument('openapiv3/simple.yml')

	const group2 = result.groups[1]
	const op2 = group2.operations[0]
	expect(op2.parameters).toBeNull()
	expect(op2.requestBody).not.toBeNull()
	expect(op2.requestBody!.schema!.type).toEqual('object')
	expect(op2.requestBody!.nativeType?.toString()).toEqual('Test2Request')
})

test('parse operation response', async() => {
	const result = await createTestDocument('openapiv3/simple.yml')

	const group1 = result.groups[0]
	const op1 = group1.operations[0]
	expect(op1.name).toEqual('getTest1')
	expect(op1.returnType).toEqual('object')
	expect(op1.returnNativeType?.toString()).toEqual('Test1Response')
	expect(op1.produces).toEqual([{ encoding: null, mediaType: 'application/json', mimeType: 'application/json' }])

	const group2 = result.groups[1]
	const op2 = group2.operations[0]
	expect(op2.returnType).toEqual('object')
	expect(op2.returnNativeType?.toString()).toEqual('Test2Response')
	expect(op2.produces).toEqual([{ encoding: null, mediaType: 'application/json', mimeType: 'application/json' }])
})

test('parse groups', async() => {
	const { result, state } = await createTestResult('openapiv3/simple.yml')

	expect(result.groups.length).toEqual(2)
	const group1 = result.groups[0]
	expect(group1.name).toEqual('test1 api')
	expect(group1.path).toEqual('/test1')
	expect(group1.operations.length).toEqual(2)

	const op1 = group1.operations[0]
	expect(op1.name).toEqual('getTest1')

	const group2 = result.groups[1]
	expect(group2.name).toEqual('test2 api')
	expect(group2.operations.length).toEqual(1)

	const op2 = group2.operations[0]
	expect(op2.name).toEqual(state.generator.toOperationName('/test2', 'POST')) /* Uses default name */
	// expect(op2.allParams!.length).toEqual(1)
	// expect(op2.returnType).not.not.toBeNull()
	// expect(op2.returnNativeType).not.not.toBeNull()
})

test('parameters at path level', async() => {
	const { result } = await createTestResult('openapiv3/parameters-at-path.yml')

	const group1 = result.groups[0]
	expect(group1.operations.length).toBe(2)

	const op1 = group1.operations[0]
	const op2 = group1.operations[1]

	expect(op1.name).toBe('getTest1')
	expect(op1.parameters).not.toBeNull()
	expect(idx.size(op1.parameters!)).toBe(1)
	expect(op2.name).toBe('postTest1')
	expect(idx.size(op2.parameters!)).toBe(2)

	const op2Parameters = idx.allValues(op2.parameters!)
	expect(op2Parameters[0].name).toBe('b')
	expect(op2Parameters[1].name).toBe('a')
})

test('summary at path level', async() => {
	const { result } = await createTestResult('openapiv3/documentation-at-path.yml')

	const group1 = result.groups[0]
	expect(group1.operations.length).toBe(2)

	const op1 = group1.operations[0]
	const op2 = group1.operations[1]

	expect(op1.summary).toBe('Operation summary')
	expect(op2.summary).toBe('Path summary')
})

test('description at path level', async() => {
	const { result } = await createTestResult('openapiv3/documentation-at-path.yml')

	const group1 = result.groups[0]
	expect(group1.operations.length).toBe(2)

	const op1 = group1.operations[0]
	const op2 = group1.operations[1]

	expect(op1.description).toBe('Path description')
	expect(op2.description).toBe('Operation description')
})
