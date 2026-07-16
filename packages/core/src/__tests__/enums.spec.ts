import { createTestDocument } from './common'
import { idx } from '..'
import { CodegenEnumSchema, CodegenSchemaType, CodegenObjectSchema } from '../../../types/dist'

test('non-unique enum values', async() => {
	const result = await createTestDocument('enums/non-unique-enum-values.yml')

	const op = result.groups[0].operations[0]
	expect(op).toBeDefined()
	expect(op.queryParams!['param1']).toBeDefined()
	expect(op.queryParams!['param1'].schema!.schemaType).toEqual(CodegenSchemaType.ENUM)
	const schema: CodegenEnumSchema = op.queryParams!['param1'].schema as CodegenEnumSchema
	expect(schema).toBeDefined()
	expect(schema.enumValues).not.toBeNull()
	expect(idx.size(schema.enumValues!)).toBe(5)

	const seenNames = new Set()
	for (const enumValue of idx.allValues(schema.enumValues!)) {
		if (seenNames.has(enumValue.name)) {
			throw new Error(`Duplicate enum value: ${enumValue.name}`)
		}
		seenNames.add(enumValue.name)
	}
	expect(seenNames.size).toBe(5)
})

test('enum value descriptions (keyed map form)', async() => {
	const result = await createTestDocument('enums/enum-descriptions.yml')

	const schema = idx.get(result.schemas, 'MappedEnum') as CodegenEnumSchema
	expect(schema).toBeDefined()
	expect(schema.schemaType).toEqual(CodegenSchemaType.ENUM)
	expect(schema.enumValues).not.toBeNull()

	expect(idx.get(schema.enumValues!, 'request_error')!.description).toEqual('Problem with request')
	expect(idx.get(schema.enumValues!, 'api_error')!.description).toEqual('Problem with API')
})

test('enum value descriptions (parallel array form)', async() => {
	const result = await createTestDocument('enums/enum-descriptions.yml')

	const schema = idx.get(result.schemas, 'ArrayEnum') as CodegenEnumSchema
	expect(schema).toBeDefined()
	expect(schema.schemaType).toEqual(CodegenSchemaType.ENUM)
	expect(schema.enumValues).not.toBeNull()

	expect(idx.get(schema.enumValues!, 'red')!.description).toEqual('The colour red')
	expect(idx.get(schema.enumValues!, 'green')!.description).toEqual('The colour green')
	expect(idx.get(schema.enumValues!, 'blue')!.description).toEqual('The colour blue')
})

test('enum without value descriptions', async() => {
	const result = await createTestDocument('enums/enum-descriptions.yml')

	const schema = idx.get(result.schemas, 'PlainEnum') as CodegenEnumSchema
	expect(schema).toBeDefined()
	expect(schema.schemaType).toEqual(CodegenSchemaType.ENUM)

	for (const enumValue of idx.allValues(schema.enumValues!)) {
		expect(enumValue.description).toBeNull()
	}
})

test('boolean with enum shouldn\'t be an enum', async() => {
	const result = await createTestDocument('enums/boolean-enum.yml')

	const test1 = idx.get(result.schemas, 'Test1') as CodegenObjectSchema
	expect(test1).toBeDefined()

	const testProperty = idx.get(test1.properties!, 'testProperty')
	expect(testProperty).toBeDefined()

	expect(testProperty?.schema.type).toEqual('boolean')
	expect(testProperty?.schema.schemaType).toEqual(CodegenSchemaType.BOOLEAN)
})
