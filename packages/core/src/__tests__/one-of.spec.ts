import { createTestDocument } from './common'
import { idx } from '../'
import util from 'util'
import { CodegenInterfaceSchema, CodegenObjectSchema, CodegenOneOfSchema, CodegenOneOfStrategy, CodegenSchemaType, CodegenWrapperSchema, isCodegenInterfaceSchema, isCodegenObjectSchema, isCodegenOneOfSchema } from '@openapi-generator-plus/types'

test('oneOf simple (native)', async() => {
	const result = await createTestDocument('one-of/one-of-simple.yml', {
		oneOfStrategy: CodegenOneOfStrategy.NATIVE,
	})

	const child = idx.get(result.schemas, 'Cat') as CodegenObjectSchema
	const parent = idx.get(result.schemas, 'Pet') as CodegenOneOfSchema

	expect(isCodegenObjectSchema(child)).toBeTruthy()
	expect(isCodegenOneOfSchema(parent)).toBeTruthy()

	expect(child.name).toEqual('Cat')
	expect(child.implements).toBeNull()
	expect(child.discriminatorValues).toBeNull()

	expect(parent.name).toEqual('Pet')
	expect(parent.discriminator).toBeNull()
	expect(parent.composes).toBeTruthy()
	expect(parent.composes!.indexOf(child)).not.toEqual(-1)
})

test('oneOf simple (object)', async() => {
	const result = await createTestDocument('one-of/one-of-simple.yml', {
		oneOfStrategy: CodegenOneOfStrategy.OBJECT,
	})

	const child = idx.get(result.schemas, 'Cat') as CodegenObjectSchema
	const parent = idx.get(result.schemas, 'Pet') as CodegenInterfaceSchema

	expect(isCodegenObjectSchema(child)).toBeTruthy()
	expect(isCodegenInterfaceSchema(parent)).toBeTruthy()

	expect(child.name).toEqual('Cat')
	expect(child.implements).toBeTruthy()
	expect(child.implements!.length).toEqual(1)
	expect(child.implements![0]).toBe(parent)
	expect(child.discriminatorValues).toBeNull()

	expect(parent.name).toEqual('Pet')
	expect(parent.discriminator).toBeNull()
	expect(parent.implementors).toBeTruthy()
	expect(parent.implementors!.indexOf(child)).not.toEqual(-1)
})

test('oneOf discriminator (native)', async() => {
	const result = await createTestDocument('one-of/one-of-discriminator.yml', {
		oneOfStrategy: CodegenOneOfStrategy.NATIVE,
	})

	const child = idx.get(result.schemas, 'Cat') as CodegenObjectSchema
	const parent = idx.get(result.schemas, 'Pet') as CodegenOneOfSchema

	expect(isCodegenObjectSchema(child)).toBeTruthy()
	expect(isCodegenOneOfSchema(parent)).toBeTruthy()

	expect(child.name).toEqual('Cat')
	expect(child.implements).toBeNull()
	expect(child.discriminatorValues).toBeTruthy()
	expect(child.discriminatorValues!.length).toEqual(1)

	expect(parent.name).toEqual('Pet')
	expect(parent.discriminator!.name).toEqual('petType')
	expect(parent.discriminator!.references.length).toEqual(3)
	expect(parent.composes).toBeTruthy()
	expect(parent.composes!.indexOf(child)).not.toEqual(-1)
})

test('oneOf discriminator (object)', async() => {
	const result = await createTestDocument('one-of/one-of-discriminator.yml', {
		oneOfStrategy: CodegenOneOfStrategy.OBJECT,
	})

	const child = idx.get(result.schemas, 'Cat') as CodegenObjectSchema
	const parent = idx.get(result.schemas, 'Pet') as CodegenInterfaceSchema

	expect(isCodegenObjectSchema(child)).toBeTruthy()
	expect(isCodegenInterfaceSchema(parent)).toBeTruthy()

	expect(child.name).toEqual('Cat')
	expect(child.implements!.length).toBe(1)
	expect(parent.name).toEqual('Pet')
	expect(parent.discriminator!.name).toEqual('petType')
	expect(parent.discriminator!.references.length).toEqual(3)
	expect(parent.children).toBeNull()
})

test('oneOf discriminator missing property (native)', async() => {
	await expect(createTestDocument('one-of/one-of-discriminator-missing-property.yml', {
		oneOfStrategy: CodegenOneOfStrategy.NATIVE,
	}))
		.rejects.toThrow('Discriminator property "petType" for "MyResponseType" missing from "Cat"')
})

test('oneOf discriminator missing property (object)', async() => {
	await expect(createTestDocument('one-of/one-of-discriminator-missing-property.yml', {
		oneOfStrategy: CodegenOneOfStrategy.OBJECT,
	}))
		.rejects.toThrow('Discriminator property "petType" for "MyResponseType" missing from "Cat"')
})

test('oneOf no discriminator (native)', async() => {
	const result = await createTestDocument('one-of/one-of-no-discriminator.yml', {
		oneOfStrategy: CodegenOneOfStrategy.NATIVE,
	})

	const combinedModel = idx.get(result.schemas, 'MyResponseType') as CodegenOneOfSchema
	const model1 = idx.get(result.schemas, 'Cat') as CodegenObjectSchema

	expect(combinedModel).toBeDefined()
	expect(model1).toBeDefined()

	expect(isCodegenOneOfSchema(combinedModel)).toBeTruthy()
	expect(combinedModel.composes.length).toEqual(3)
	expect(combinedModel.composes.indexOf(model1)).not.toEqual(-1)

	expect(isCodegenObjectSchema(model1)).toBeTruthy()
	expect(model1.implements).toBeNull()
})

test('oneOf no discriminator (object)', async() => {
	const result = await createTestDocument('one-of/one-of-no-discriminator.yml', {
		oneOfStrategy: CodegenOneOfStrategy.OBJECT,
	})

	const combinedModel = idx.get(result.schemas, 'MyResponseType') as CodegenInterfaceSchema
	expect(combinedModel).toBeDefined()
	expect(isCodegenInterfaceSchema(combinedModel)).toBeTruthy()

	/* The combined model has no properties, as it implements the parent interfaces */
	expect(combinedModel.properties).toBeNull()

	const model1 = idx.get(result.schemas, 'Cat') as CodegenObjectSchema
	expect(model1).toBeDefined()
	expect(isCodegenObjectSchema(model1)).toBeTruthy()
	expect(model1.implements!.find(s => s.name === 'MyResponseType')).toBeTruthy()
})

test('oneOf property no discriminator (object)', async() => {
	const result = await createTestDocument('one-of/one-of-property-no-discriminator.yml', {
		oneOfStrategy: CodegenOneOfStrategy.OBJECT,
	})

	const someObject = idx.get(result.schemas, 'SomeObject') as CodegenObjectSchema
	expect(someObject).toBeDefined()
	expect(someObject.schemaType).toEqual(CodegenSchemaType.OBJECT)

	const submodels = idx.allValues(someObject!.schemas!)
	expect(submodels.length).toEqual(1)
	const submodel = submodels[0] as CodegenInterfaceSchema
	expect(isCodegenInterfaceSchema(submodel)).toBeTruthy()
})

test('oneOf arrays (native)', async() => {
	const result = await createTestDocument('one-of/one-of-arrays.yml', {
		oneOfStrategy: CodegenOneOfStrategy.NATIVE,
	})
	expect(result).toBeDefined()

	const polygon = result.schemas['Polygon'] as CodegenObjectSchema
	expect(polygon).toBeDefined()
	expect(isCodegenObjectSchema(polygon)).toBeTruthy()
	expect(polygon.schemas).not.toBeNull()
	const coordinates = idx.get(polygon.schemas!, 'coordinates') as CodegenOneOfSchema
	expect(coordinates.schemaType).toEqual(CodegenSchemaType.ONEOF)
	expect(coordinates.composes).toBeTruthy()
	expect(coordinates.composes.length).toEqual(2)

	const oneOfCoordinates = coordinates.composes[0]
	expect(oneOfCoordinates.nativeType.nativeType).toEqual('array array array number')
	expect(oneOfCoordinates.schemaType).toEqual(CodegenSchemaType.ARRAY)
})

test('oneOf arrays (object)', async() => {
	const result = await createTestDocument('one-of/one-of-arrays.yml', {
		oneOfStrategy: CodegenOneOfStrategy.OBJECT,
	})
	expect(result).toBeDefined()

	const polygon = result.schemas['Polygon'] as CodegenObjectSchema
	expect(polygon).toBeDefined()
	expect(isCodegenObjectSchema(polygon)).toBeTruthy()
	expect(polygon.schemas).not.toBeNull()
	const coordinates = idx.allValues(polygon.schemas!)[1] as CodegenInterfaceSchema
	expect(coordinates.schemaType).toEqual(CodegenSchemaType.INTERFACE)
	expect(coordinates.implementors).not.toBeNull()
	expect(coordinates.implementors!.length).toEqual(2)

	const oneOfCoordinates = coordinates.implementors![0] as CodegenWrapperSchema
	expect(oneOfCoordinates.schemaType).toEqual(CodegenSchemaType.WRAPPER)
	expect(oneOfCoordinates.nativeType.nativeType).toEqual('Polygon.coordinates.array_value')

	expect(oneOfCoordinates.property.nativeType.nativeType).toEqual('array array array number')
	expect(oneOfCoordinates.property.schemaType).toEqual(CodegenSchemaType.ARRAY)
})
