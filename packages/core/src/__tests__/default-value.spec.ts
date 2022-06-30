import { createTestDocument } from './common'
import { CodegenObjectSchema, CodegenSchemaType } from '@openapi-generator-plus/types'
import { idx } from '../'

test('array property', async() => {
	const result = await createTestDocument('default-value/arrays-v3.yml')

	expect(idx.size(result.schemas)).toEqual(1)

	const models = idx.allValues(result.schemas)
	const model1 = models[0] as CodegenObjectSchema
	expect(model1.name).toEqual('Test')
	expect(idx.size(model1.properties!)).toEqual(3)

	const model1Properties = idx.allValues(model1.properties!)
	const prop1 = model1Properties[0]
	expect(prop1.name).toBe('arrayProperty')
	expect(prop1.schema.schemaType).toEqual(CodegenSchemaType.ARRAY)
	expect(prop1.defaultValue).toBeNull()

	const prop2 = model1Properties[1]
	expect(prop2.name).toBe('notRequiredArrayProperty')
	expect(prop2.schema.schemaType).toEqual(CodegenSchemaType.ARRAY)
	expect(prop2.defaultValue).toBeNull()

	const prop3 = model1Properties[2]
	expect(prop3.name).toBe('arrayPropertyWithDefault')
	expect(prop3.schema.schemaType).toEqual(CodegenSchemaType.ARRAY)
	expect(prop3.defaultValue).toEqual({ value: [], literalValue: '[]' })
})

test('primitives', async() => {
	const result = await createTestDocument('default-value/primitives.yml')

	expect(idx.size(result.schemas)).toEqual(2)

	const models = idx.allValues(result.schemas)
	const allDefaults = models[0] as CodegenObjectSchema
	const noDefaults = models[1] as CodegenObjectSchema

	expect(allDefaults.serializedName).toEqual('AllDefaults')
	expect(noDefaults.serializedName).toEqual('NoDefaults')

	const allDefaultsProperties = idx.allValues(allDefaults.properties!)
	expect(allDefaultsProperties.length).toEqual(6)

	const noDefaultsProperties = idx.allValues(noDefaults.properties!)
	expect(noDefaultsProperties.length).toEqual(6)

	/* All properties should have default values */
	for (const property of allDefaultsProperties) {
		expect(property.defaultValue).not.toBeNull()
	}

	/* No properties should have default values */
	for (const property of noDefaultsProperties) {
		expect(property.defaultValue).toBeNull()
	}

	expect(allDefaultsProperties[0].defaultValue?.value).toEqual('Hello')
	expect(allDefaultsProperties[0].defaultValue?.literalValue).toEqual('"Hello"')
	expect(allDefaultsProperties[1].defaultValue?.value).toEqual(3.5)
	expect(allDefaultsProperties[1].defaultValue?.literalValue).toEqual('3.5')
	expect(allDefaultsProperties[2].defaultValue?.value).toEqual(7)
	expect(allDefaultsProperties[5].defaultValue?.value).toEqual(true)
	expect(allDefaultsProperties[5].defaultValue?.literalValue).toEqual('true')
})
