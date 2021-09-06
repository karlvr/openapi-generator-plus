import { createTestDocument } from './common'
import { idx } from '../'
import { CodegenAnyOfSchema, CodegenAnyOfStrategy, CodegenObjectSchema, CodegenSchemaType, isCodegenObjectSchema } from '@openapi-generator-plus/types'

test('anyOf (native)', async() => {
	const result = await createTestDocument('any-of/any-of.yml', {
		anyOfStrategy: CodegenAnyOfStrategy.NATIVE,
	})

	const someObject = idx.get(result.schemas, 'SomeObject') as CodegenObjectSchema
	expect(someObject).toBeDefined()
	expect(someObject.schemaType).toEqual(CodegenSchemaType.OBJECT)

	const submodels = idx.allValues(someObject.schemas!)
	expect(submodels.length).toEqual(1)

	const submodel = submodels[0] as CodegenAnyOfSchema
	expect(submodel.schemaType).toEqual(CodegenSchemaType.ANYOF)
	expect(submodel.implements).toBeNull()
	expect(submodel.composes).toBeTruthy()
	expect(submodel.composes!.length).toEqual(2)
})

test('anyOf (object)', async() => {
	const result = await createTestDocument('any-of/any-of.yml', {
		anyOfStrategy: CodegenAnyOfStrategy.OBJECT,
	})

	const someObject = idx.get(result.schemas, 'SomeObject') as CodegenObjectSchema
	expect(someObject).toBeDefined()
	expect(someObject.schemaType).toEqual(CodegenSchemaType.OBJECT)

	const submodel = idx.get(someObject!.schemas!, 'color') as CodegenObjectSchema
	expect(submodel.schemaType).toEqual(CodegenSchemaType.OBJECT)
	expect(submodel.implements).not.toBeNull()
	expect(submodel.implements!.length).toEqual(2)

	expect(idx.size(submodel.properties!)).toEqual(5)
	for (const property of idx.values(submodel.properties!)) {
		expect(property.required).toBeFalsy()
	}
})
