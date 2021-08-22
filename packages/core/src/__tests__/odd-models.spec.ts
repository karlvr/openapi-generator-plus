import { createTestDocument, createTestGenerator } from './common'
import { idx } from '../'
import { CodegenObjectSchema, CodegenObjectSchemas, CodegenSchemaType } from '../../../types/dist'

test('array of strings without collection models', async() => {
	const result = await createTestDocument('odd-models/array-of-strings-v2.yml')

	const models = idx.allValues(result.schemas)
	expect(models.length).toEqual(0)

	const response = result.groups[0].operations[0].defaultResponse
	expect(response).not.toBeNull()

	const nativeType = response!.defaultContent?.nativeType
	expect(nativeType).not.toBeNull()
	expect(nativeType!.toString()).toEqual('array string')
})

test('uuid', async() => {
	const result = await createTestDocument('odd-models/uuid-v2.yml')

	/* We don't parse the UUID type as a model */
	expect(idx.size(result.schemas)).toEqual(0)

	/* Note that there doesn't seem to be a way to _use_ schemas like this actually */
})

test('missing schema', async() => {
	const result = await createTestDocument('odd-models/missing-schema.yml')
	const op = result.groups[0].operations[0]
	expect(op).toBeDefined()
	expect(op.queryParams!['param1']).toBeDefined()
	expect(op.queryParams!['param1'].schemaType).toEqual(CodegenSchemaType.STRING)
	expect(op.responses![200]).toBeDefined()
	expect(op.responses![200].headers!['ResponseHeader']).toBeDefined()
	expect(op.responses![200].headers!['ResponseHeader'].schemaType).toEqual(CodegenSchemaType.STRING)
})

test('property names not legal identifiers', async() => {
	const result = await createTestDocument('odd-models/property-name-not-identifier-safe.yml')
	const generator = createTestGenerator()

	const op = result.groups[0].operations[0]
	const schema = op.defaultResponse!.defaultContent!.schema as CodegenObjectSchema
	expect(schema).toBeDefined()

	const propertyName = generator.toIdentifier('a-hyphenated-property')
	expect(propertyName).not.toEqual('a-hyphenated-property')
	
	const property = idx.get(schema.properties!, propertyName)
	expect(property).toBeDefined()
	expect(property!.name).toEqual(propertyName)
	expect(property!.serializedName).toEqual('a-hyphenated-property')
})

test('property names not legal identifiers non-unique', async() => {
	const result = await createTestDocument('odd-models/property-name-not-identifier-safe-non-unique.yml')
	const generator = createTestGenerator()

	const op = result.groups[0].operations[0]
	const schema = op.defaultResponse!.defaultContent!.schema as CodegenObjectSchema
	expect(schema).toBeDefined()

	expect(idx.size(schema.properties!)).toBe(2)

	const propertyName = generator.toIdentifier('a-hyphenated-property')
	const propertyName2 = generator.toIdentifier('a-hyphenated-Property')
	expect(propertyName).not.toEqual('a-hyphenated-property')
	expect(propertyName).toEqual(propertyName2)
	
	console.log(schema.properties)

	const property = idx.get(schema.properties!, propertyName)
	expect(property).toBeDefined()
	expect(property!.name).toEqual(propertyName)
	expect(property!.serializedName).toEqual('a-hyphenated-property')

	const actualPropertyName2 = generator.toIteratedSchemaName(propertyName2, undefined, 1)
	const property2 = idx.get(schema.properties!, actualPropertyName2)
	expect(property2).toBeDefined()
	expect(property2!.name).toEqual(actualPropertyName2)
	expect(property2!.serializedName).toEqual('a-hyphenated-Property')
})
