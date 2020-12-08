import { createTestDocument } from './common'
import { idx } from '../'
import { CodegenObjectSchema, isCodegenObjectSchema } from '@openapi-generator-plus/types'

test('any-of', async() => {
	const result = await createTestDocument('any-of/any-of.yml')

	const someObject = idx.find(result.schemas, m => m.name === 'SomeObject')
	expect(someObject).toBeDefined()
	if (!isCodegenObjectSchema(someObject!)) {
		throw new Error('Not an object schema')
	}
	expect(someObject!.isInterface).toBeFalsy()

	const submodels = idx.allValues(someObject!.schemas!)
	expect(submodels.length).toEqual(1)

	const submodel = submodels[0] as CodegenObjectSchema
	expect(submodel.isInterface).toBeFalsy()
	expect(submodel.implements).not.toBeNull()
	expect(idx.size(submodel.implements!)).toEqual(2)

	expect(idx.size(submodel.properties!)).toEqual(5)
	for (const property of idx.values(submodel.properties!)) {
		expect(property.required).toBeFalsy()
	}
})
