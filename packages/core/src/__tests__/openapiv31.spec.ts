import { createTestDocument } from './common'
import { idx } from '..'
import { CodegenAllOfStrategy, CodegenObjectSchema, CodegenSchemaType } from '@openapi-generator-plus/types'
import { findProperty } from '../process/schema/utils'

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

test('required on all-of with incompatible base', async() => {
	const result = await createTestDocument('openapiv31/required-on-all-of.yml', {
		allOfStrategy: CodegenAllOfStrategy.OBJECT,
	})

	const schema = idx.get(result.schemas, 'First') as CodegenObjectSchema
	expect(schema.schemaType).toBe(CodegenSchemaType.OBJECT)

	expect(schema.parents).toBeNull() /* Because it's not compatible due to required on "first" */

	const first = idx.get(schema.properties!, 'first')!
	expect(first).toBeTruthy()
	expect(first.schema.schemaType).toBe(CodegenSchemaType.STRING)
	expect(first.required).toBeTruthy()

	const second = idx.get(schema.properties!, 'second')!
	expect(second).toBeTruthy()
	expect(second.schema.schemaType).toBe(CodegenSchemaType.STRING)
	expect(second.required).toBeTruthy()
})

test('required on all-of base', async() => {
	const result = await createTestDocument('openapiv31/required-on-all-of.yml', {
		allOfStrategy: CodegenAllOfStrategy.OBJECT,
		supportsInheritance: true,
	})

	const schema = idx.get(result.schemas, 'Base') as CodegenObjectSchema
	expect(schema.schemaType).toBe(CodegenSchemaType.OBJECT)

	const first = idx.get(schema.properties!, 'first')!
	expect(first).toBeTruthy()
	expect(first.schema.schemaType).toBe(CodegenSchemaType.STRING)
	expect(first.required).toBeFalsy()
})

test('required on all-of with compatible base', async() => {
	const result = await createTestDocument('openapiv31/required-on-all-of.yml', {
		allOfStrategy: CodegenAllOfStrategy.OBJECT,
		supportsInheritance: true,
	})

	const schema = idx.get(result.schemas, 'Second') as CodegenObjectSchema
	expect(schema.schemaType).toBe(CodegenSchemaType.OBJECT)

	expect(schema.parents).not.toBeNull() /* Because it's compatible due to required on "first" on base */

	const first = findProperty(schema, 'first')!
	expect(first).toBeTruthy()
	expect(first.schema.schemaType).toBe(CodegenSchemaType.STRING)
	expect(first.required).toBeTruthy()

	const second = findProperty(schema, 'second')!
	expect(second).toBeTruthy()
	expect(second.schema.schemaType).toBe(CodegenSchemaType.STRING)
	expect(second.required).toBeTruthy()
})
