import { createTestDocument, createTestResult } from './common'
import { idx } from '..'
import { CodegenObjectSchema, CodegenSchemaType } from '@openapi-generator-plus/types'

test('process document', async() => {
	const result = await createTestDocument('openapiv31/simple.yml')
	expect(result).toBeDefined()
})

test('parse null string', async() => {
	const result = await createTestDocument('openapiv31/simple.yml')

	const schema = idx.get(result.schemas, 'Test2Request') as CodegenObjectSchema
	expect(schema.schemaType).toBe(CodegenSchemaType.OBJECT)

	const nullProp = idx.get(schema.properties!, 'first')
	expect(nullProp?.schema.schemaType).toBe(CodegenSchemaType.STRING)
	expect(nullProp?.nullable).toBeTruthy()
})

test('parse null reference', async() => {
	const result = await createTestDocument('openapiv31/simple.yml')

	const schema = idx.get(result.schemas, 'Test2Response') as CodegenObjectSchema
	expect(schema.schemaType).toBe(CodegenSchemaType.OBJECT)

	const nullProp = idx.get(schema.properties!, 'object')
	expect(nullProp?.schema.schemaType).toBe(CodegenSchemaType.OBJECT)
	expect(nullProp?.nullable).toBeTruthy()
})
