import { createTestDocument } from './common'
import { idx } from '..'
import { CodegenAllOfStrategy, CodegenArraySchema, CodegenObjectSchema, CodegenSchemaType } from '@openapi-generator-plus/types'
import { findProperty } from '../process/schema/utils'

test('process document', async() => {
	const result = await createTestDocument('openapiv31/simple.yml')
	expect(result).toBeDefined()
})

test('parse Xquik search operation', async() => {
	const result = await createTestDocument('openapiv31/xquik-search.yml')

	expect(result.info.title).toEqual('Xquik API')
	expect(result.servers![0].url).toEqual('https://xquik.com')
	expect(result.securitySchemes).not.toBeNull()
	expect(result.securitySchemes?.[0].name).toEqual('apiKey')
	expect(result.securitySchemes?.[0].in).toEqual('header')
	expect(result.securitySchemes?.[0].paramName).toEqual('x-api-key')

	let operation = undefined
	for (const group of result.groups) {
		for (const candidate of group.operations) {
			if (candidate.name === 'searchTweets') {
				operation = candidate
				break
			}
		}
		if (operation) {
			break
		}
	}
	expect(operation).toBeDefined()
	expect(operation?.path).toEqual('/v1/x/tweets/search')
	expect(operation?.parameters).not.toBeNull()
	expect(idx.allValues(operation!.parameters!).map((parameter: { name: string }) => parameter.name)).toEqual(['q', 'cursor', 'limit'])
	expect(operation?.securityRequirements?.requirements[0].schemes[0].scheme.name).toEqual('apiKey')
	expect(operation?.returnNativeType?.toString()).toEqual('SearchTweetsResponse')
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

test('any schema', async() => {
	const result = await createTestDocument('openapiv31/any-schema.yml')
	expect(result).toBeDefined()

	const schema = idx.get(result.schemas, 'TestObject') as CodegenObjectSchema
	expect(schema.schemaType).toBe(CodegenSchemaType.OBJECT)

	const property = idx.get(schema.properties!, 'test')
	expect(property?.schema.schemaType).toBe(CodegenSchemaType.ANY)
})

test('array without items schema', async() => {
	const result = await createTestDocument('openapiv31/array-without-items-schema.yml')
	expect(result).toBeDefined()

	const schema = idx.get(result.schemas, 'TestObject') as CodegenObjectSchema
	expect(schema.schemaType).toBe(CodegenSchemaType.OBJECT)

	const property = idx.get(schema.properties!, 'test')
	expect(property?.schema.schemaType).toBe(CodegenSchemaType.ARRAY)
	
	expect((property?.schema as CodegenArraySchema).component.schema.schemaType).toBe(CodegenSchemaType.ANY)
})
