import { createTestDocument, createTestResult } from './common'

test('process document', async() => {
	const result = await createTestDocument('openapiv3-1.yml')
	expect(result).toBeDefined()
})

test('parse info', async() => {
	const result = await createTestDocument('openapiv3-1.yml')

	expect(result.info.description).toEqual('Lorem ipsum')
	expect(result.info.version).toEqual('1.0.1')
	expect(result.info.title).toEqual('Example')
	expect(result.servers).toBeDefined()
	expect(result.servers![0].url).toEqual('http://example.com/api/v1')
	expect(result.servers![1].url).toEqual('https://example.com/api/v1')
})

test('parse operation params', async() => {
	const result = await createTestDocument('openapiv3-1.yml')

	const group1 = result.groups[0]
	const op1 = group1.operations[0]
	expect(op1.name).toEqual('getTest1')
	expect(op1.allParams).toBeDefined()
	expect(op1.allParams!.length).toEqual(2)
})

test('parse operation body params', async() => {
	const result = await createTestDocument('openapiv3-1.yml')

	const group2 = result.groups[1]
	const op2 = group2.operations[0]
	expect(op2.allParams!.length).toEqual(1)
	expect(op2.allParams![0].in).toEqual('body')
	expect(op2.allParams![0].type).toEqual('object')
	expect(op2.allParams![0].nativeType?.toString()).toEqual('Test2Request')
})

test('parse operation response', async() => {
	const result = await createTestDocument('openapiv3-1.yml')

	const group1 = result.groups[0]
	const op1 = group1.operations[0]
	expect(op1.name).toEqual('getTest1')
	expect(op1.returnType).toEqual('object')
	expect(op1.returnNativeType?.toString()).toEqual('Test1Response')
	expect(op1.produces).toEqual([{ mediaType: 'application/json', mimeType: 'application/json' }])

	const group2 = result.groups[1]
	const op2 = group2.operations[0]
	expect(op2.returnType).toEqual('object')
	expect(op2.returnNativeType?.toString()).toEqual('Test2Response')
	expect(op2.produces).toEqual([{ mediaType: 'application/json', mimeType: 'application/json' }])
})

test('parse groups', async() => {
	const { result, state } = await createTestResult('openapiv3-1.yml')

	expect(result.groups.length).toEqual(2)
	const group1 = result.groups[0]
	expect(group1.name).toEqual('test1')
	expect(group1.path).toEqual('/test1')
	expect(group1.operations.length).toEqual(2)

	const op1 = group1.operations[0]
	expect(op1.name).toEqual('getTest1')

	const group2 = result.groups[1]
	expect(group2.name).toEqual('test2')
	expect(group2.operations.length).toEqual(1)

	const op2 = group2.operations[0]
	expect(op2.name).toEqual(state.generator.toOperationName('/test2', 'POST', state)) /* Uses default name */
	// expect(op2.allParams!.length).toEqual(1)
	// expect(op2.returnType).not.toBeDefined()
	// expect(op2.returnNativeType).not.toBeDefined()
})
