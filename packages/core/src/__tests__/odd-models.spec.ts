import { createTestDocument, createTestGenerator } from './common'
import { idx } from '../'
import { CodegenObjectSchema, CodegenSchemaType, CodegenOneOfStrategy, CodegenWrapperSchema, CodegenMapSchema, CodegenAllOfStrategy, CodegenOneOfSchema, CodegenInterfaceSchema } from '@openapi-generator-plus/types'

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

test('missing parameter schema', async() => {
	const result = await createTestDocument('odd-models/missing-parameter-schema.yml')
	const op = result.groups[0].operations[0]
	expect(op).toBeDefined()
	expect(op.queryParams!['param1']).toBeDefined()
	expect(op.queryParams!['param1'].schema!.schemaType).toEqual(CodegenSchemaType.STRING)
	expect(op.responses![200]).toBeDefined()
	expect(op.responses![200].headers!['ResponseHeader']).toBeDefined()
	expect(op.responses![200].headers!['ResponseHeader'].schema!.schemaType).toEqual(CodegenSchemaType.STRING)
})

test('property names not legal identifiers', async() => {
	const result = await createTestDocument('odd-models/property-name-not-identifier-safe.yml')
	const generator = createTestGenerator()

	const op = result.groups[0].operations[0]
	const schema = op.defaultResponse!.defaultContent!.schema as CodegenObjectSchema
	expect(schema).toBeDefined()

	const propertyName = generator.toIdentifier('a-hyphenated-property')
	expect(propertyName).not.toEqual('a-hyphenated-property')
	
	const property = idx.get(schema.properties!, 'a-hyphenated-property')
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
	
	const property = idx.get(schema.properties!, 'a-hyphenated-property')
	expect(property).toBeDefined()
	expect(property!.name).toEqual(propertyName)
	expect(property!.serializedName).toEqual('a-hyphenated-property')

	const actualPropertyName2 = generator.toIteratedSchemaName(propertyName2, undefined, 1)
	const property2 = idx.get(schema.properties!, 'a-hyphenated-Property')
	expect(property2).toBeDefined()
	expect(property2!.name).toEqual(actualPropertyName2)
	expect(property2!.serializedName).toEqual('a-hyphenated-Property')
})

test('missing response content schema', async() => {
	const result = await createTestDocument('odd-models/missing-response-content-schema.yml')

	const op = result.groups[0].operations[0]
	const content = op.defaultResponse!.defaultContent!
	expect(content).toBeTruthy()
	expect(content.schema).toBeNull()
})

test('missing request body schema', async() => {
	const result = await createTestDocument('odd-models/missing-request-body-schema.yml')

	const op = result.groups[0].operations[0]
	expect(op.requestBody).toBeTruthy()
	expect(op.requestBody!.schema).toBeNull()
	const content = op.defaultResponse!.defaultContent!
	expect(content).toBeNull()
})

test('double reference', async() => {
	const result = await createTestDocument('odd-models/double-reference.yml', {
		oneOfStrategy: CodegenOneOfStrategy.INTERFACE,
		supportsInheritance: true,
		supportsMultipleInheritance: true,
	})

	expect(result).toBeDefined()

	const colour = idx.get(result.schemas, 'colour') as CodegenObjectSchema
	expect(colour.schemaType).toEqual(CodegenSchemaType.OBJECT)
	expect(colour.nullable).toBeFalsy()

	const colourValue = idx.get(result.schemas, 'ColourValue') as CodegenObjectSchema
	expect(colourValue.schemaType).toEqual(CodegenSchemaType.OBJECT)
	expect(colourValue.nullable).toBeTruthy()

	/* Wrapper schemas are always scoped, so no longer in the global scope */
	const globalColourCollectionValue = idx.get(result.schemas, 'ColourCollectionValue') as CodegenWrapperSchema | undefined
	expect(globalColourCollectionValue).toBeUndefined()

	const response = idx.get(result.schemas, 'Response') as CodegenInterfaceSchema
	expect(response.schemaType).toEqual(CodegenSchemaType.INTERFACE)
	expect(response.schemas).not.toBeNull()
	
	const colourCollectionValue = idx.get(response.schemas!, 'ColourCollectionValue') as CodegenWrapperSchema
	expect(colourCollectionValue).toBeDefined()
	expect(colourCollectionValue.schemaType).toEqual(CodegenSchemaType.WRAPPER)
	expect(colourCollectionValue.property.schema.schemaType).toEqual(CodegenSchemaType.ARRAY)
	expect(colourCollectionValue.property.schema.component).toBeTruthy()
	expect(colourCollectionValue.property.schema.component?.schema.schemaType).toEqual(CodegenSchemaType.OBJECT)
	expect(colourCollectionValue.property.schema.component?.schema.name).toEqual('ColourValue')
	expect(colourCollectionValue.property.schema.component?.schema).toBe(colourValue) /* Ensure that we've correctly re-used the same schema for ColourValue */
})

test('empty additionalProperties', async() => {
	const result = await createTestDocument('odd-models/empty-additional-properties.yml')
	expect(result).toBeDefined()

	const emptyAdditionalProperties = result.schemas['EmptyAdditionalProperties'] as CodegenObjectSchema
	expect(emptyAdditionalProperties).toBeDefined()
	expect(emptyAdditionalProperties.additionalProperties).not.toBeNull()

	const emptyAdditionalPropertiesSchema = emptyAdditionalProperties.additionalProperties as CodegenMapSchema
	expect(emptyAdditionalPropertiesSchema.schemaType).toEqual(CodegenSchemaType.MAP)
	expect(emptyAdditionalPropertiesSchema.nativeType.nativeType).toEqual('map string')

	const trueAdditionalProperties = result.schemas['TrueAdditionalProperties'] as CodegenObjectSchema
	expect(trueAdditionalProperties).toBeDefined()
	expect(trueAdditionalProperties.additionalProperties).not.toBeNull()

	const trueAdditionalPropertiesSchema = trueAdditionalProperties.additionalProperties as CodegenMapSchema
	expect(trueAdditionalPropertiesSchema.schemaType).toEqual(CodegenSchemaType.MAP)
	expect(trueAdditionalPropertiesSchema.nativeType.nativeType).toEqual('map string')

	const falseAdditionalProperties = result.schemas['FalseAdditionalProperties'] as CodegenObjectSchema
	expect(falseAdditionalProperties).toBeDefined()
	expect(falseAdditionalProperties.additionalProperties).toBeNull()
})

test('additional properties no schema', async() => {
	const result = await createTestDocument('odd-models/additional-properties-no-schema.yml', { expectLogWarnings: true, allOfStrategy: CodegenAllOfStrategy.OBJECT })
	expect(result).toBeDefined()

	const emptyAdditionalProperties = result.schemas['NullableAdditionalProperties'] as CodegenObjectSchema
	expect(emptyAdditionalProperties).toBeDefined()
	expect(emptyAdditionalProperties.additionalProperties).toBeNull()

	const reffingAdditionalProperties = result.schemas['ReffingNullableAdditionalProperties'] as CodegenObjectSchema
	expect(reffingAdditionalProperties).toBeDefined()
	expect(reffingAdditionalProperties.additionalProperties).toBeFalsy()

})
