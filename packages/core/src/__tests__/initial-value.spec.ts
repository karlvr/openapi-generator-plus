import { createTestDocument } from './common'
import { CodegenObjectSchema, CodegenSchemaType } from '@openapi-generator-plus/types'
import { idx } from '../'

test('array property', async() => {
	const result = await createTestDocument('initial-value/arrays-v3.yml')

	expect(idx.size(result.schemas)).toEqual(1)

	const models = idx.allValues(result.schemas)
	const model1 = models[0] as CodegenObjectSchema
	expect(model1.name).toEqual('Test')
	expect(idx.size(model1.properties!)).toEqual(3)

	const model1Properties = idx.allValues(model1.properties!)

	const prop1 = model1Properties[0]
	expect(prop1.name).toBe('arrayProperty')
	expect(prop1.schema.schemaType).toEqual(CodegenSchemaType.ARRAY)
	/* has an initial value as it's required */
	expect(prop1.initialValue).toEqual({ value: [], literalValue: '[]' })

	const prop2 = model1Properties[1]
	expect(prop2.name).toBe('notRequiredArrayProperty')
	expect(prop2.schema.schemaType).toEqual(CodegenSchemaType.ARRAY)
	/* no initial value as it's not required */
	expect(prop2.initialValue).toBeNull()

	const prop3 = model1Properties[2]
	expect(prop3.name).toBe('arrayPropertyWithDefault')
	expect(prop3.schema.schemaType).toEqual(CodegenSchemaType.ARRAY)
	/* has an initial value as it has a default */
	expect(prop3.initialValue).toEqual({ value: [], literalValue: '[]' })
})

test('primitives', async() => {
	const result = await createTestDocument('initial-value/primitives.yml')

	expect(idx.size(result.schemas)).toEqual(2)

	const models = idx.allValues(result.schemas)

	const allRequired = models[0] as CodegenObjectSchema
	expect(allRequired.serializedName).toEqual('AllRequired')
	const allRequiredProperties = idx.allValues(allRequired.properties!)

	/* No properties have initial values because they're all primitives, even though they're required */
	for (const prop of allRequiredProperties) {
		expect(prop.initialValue).toBeNull()
	}

	const noneRequired = models[1] as CodegenObjectSchema
	expect(noneRequired.serializedName).toEqual('NoneRequired')
	const noneRequiredProperties = idx.allValues(noneRequired.properties!)

	/* No properties have initial values because they're all primitives, even though they're required */
	for (const prop of noneRequiredProperties) {
		expect(prop.initialValue).toBeNull()
	}
})
