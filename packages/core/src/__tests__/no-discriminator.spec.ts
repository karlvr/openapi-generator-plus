import { createTestDocument } from './common'
import { idx } from '../'
import { CodegenObjectSchema, isCodegenObjectSchema } from '@openapi-generator-plus/types'

test('one of no discriminator', async() => {
	const result = await createTestDocument('no-discriminator/one-of-no-discriminator.yml')

	const combinedModel = idx.find(result.schemas, m => m.name === 'MyResponseType') as CodegenObjectSchema
	expect(combinedModel).toBeDefined()
	expect(isCodegenObjectSchema(combinedModel)).toBeTruthy()
	expect(combinedModel!.isInterface).toBeTruthy()

	/* The combined model has no properties, as it implements the parent interfaces */
	const combinedModelProperties = idx.allValues(combinedModel!.properties!)
	expect(combinedModelProperties.length).toEqual(0)

	const model1 = idx.find(result.schemas, m => m.name === 'Cat') as CodegenObjectSchema
	expect(model1).toBeDefined()
	expect(isCodegenObjectSchema(model1)).toBeTruthy()
	expect(model1.isInterface).toBeFalsy()
	expect(model1.implements!['MyResponseType']).toBeTruthy()
})

test('one of no discriminator need interface', async() => {
	const result = await createTestDocument('no-discriminator/one-of-no-discriminator-needs-interfaces.yml')

	const someObject = idx.find(result.schemas, m => m.name === 'SomeObject') as CodegenObjectSchema
	expect(someObject).toBeDefined()
	expect(isCodegenObjectSchema(someObject)).toBeTruthy()
	expect(someObject!.isInterface).toBeFalsy()

	const submodels = idx.allValues(someObject!.schemas!)
	expect(submodels.length).toEqual(1)
	const submodel = submodels[0] as CodegenObjectSchema
	expect(isCodegenObjectSchema(submodel)).toBeTruthy()
	expect(submodel.isInterface).toBeTruthy()
})

test('polygon', async() => {
	const result = await createTestDocument('no-discriminator/one-of-polygon.yml')
	expect(result).toBeDefined()

	const polygon = result.schemas['Polygon'] as CodegenObjectSchema
	expect(polygon).toBeDefined()
	expect(isCodegenObjectSchema(polygon)).toBeTruthy()
	expect(polygon.schemas).not.toBeNull()
	const coordinates = polygon.schemas!['coordinates_model'] as CodegenObjectSchema
	expect(isCodegenObjectSchema(coordinates)).toBeTruthy()
	expect(coordinates.implementors).not.toBeNull()
	expect(idx.size(coordinates.implementors!)).toEqual(2)

	const oneOfCoordinates = idx.allValues(coordinates.implementors!)[0]
	expect(oneOfCoordinates.nativeType.nativeType).toEqual('array array array number')
})
