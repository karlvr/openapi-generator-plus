import { createTestDocument } from './common'
import { idx } from '../'
import { CodegenAnyOfSchema, CodegenAnyOfStrategy, CodegenInterfaceSchema, CodegenObjectSchema, CodegenSchemaType, CodegenWrapperSchema, isCodegenInterfaceSchema, isCodegenWrapperSchema } from '@openapi-generator-plus/types'

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

test('anyOf of primitives (object)', async() => {
	const result = await createTestDocument('any-of/any-of-primitives.yml', {
		anyOfStrategy: CodegenAnyOfStrategy.OBJECT,
	})

	const product = idx.get(result.schemas, 'Product') as CodegenObjectSchema
	expect(product).toBeDefined()

	const imageUrl = idx.get(product.properties!, 'image_url')
	expect(imageUrl).toBeDefined()

	/* The anyOf of two string schemas (plus null) becomes a nullable interface implemented by a typed wrapper for
	   each member, so each member keeps its own type rather than being collapsed to a common type. */
	expect(imageUrl!.nullable).toBe(true)
	expect(isCodegenInterfaceSchema(imageUrl!.schema)).toBe(true)
	const iface = imageUrl!.schema as CodegenInterfaceSchema

	expect(iface.implementors).not.toBeNull()
	expect(iface.implementors!.length).toEqual(2)
	for (const implementor of iface.implementors!) {
		expect(isCodegenWrapperSchema(implementor)).toBe(true)
	}

	const imageUrlWrapper = iface.implementors!.find(i => i.name === 'ImageUrl') as CodegenWrapperSchema
	expect(imageUrlWrapper).toBeDefined()
	expect(imageUrlWrapper.property.schema.schemaType).toEqual(CodegenSchemaType.STRING)
	expect(imageUrlWrapper.property.schema.format).toEqual('uri')

	const emptyStringWrapper = iface.implementors!.find(i => i.name === 'EmptyString') as CodegenWrapperSchema
	expect(emptyStringWrapper).toBeDefined()
	expect(emptyStringWrapper.property.schema.schemaType).toEqual(CodegenSchemaType.STRING)
	expect(emptyStringWrapper.property.schema.format).toBeNull()
})

test('anyOf of primitives is not collapsed (native)', async() => {
	const result = await createTestDocument('any-of/any-of-primitives.yml', {
		anyOfStrategy: CodegenAnyOfStrategy.NATIVE,
	})

	const product = idx.get(result.schemas, 'Product') as CodegenObjectSchema
	expect(product).toBeDefined()

	const imageUrl = idx.get(product.properties!, 'image_url')
	expect(imageUrl).toBeDefined()

	/* The native strategy keeps the union of the members rather than collapsing to a single type */
	expect(imageUrl!.schema.schemaType).toEqual(CodegenSchemaType.ANYOF)
	const anyOfSchema = imageUrl!.schema as CodegenAnyOfSchema
	expect(anyOfSchema.composes).toBeTruthy()
	expect(anyOfSchema.composes.length).toEqual(2)
})

test('anyOf of different primitive types wraps each member (object)', async() => {
	const result = await createTestDocument('any-of/any-of-different-primitives.yml', {
		anyOfStrategy: CodegenAnyOfStrategy.OBJECT,
	})

	const product = idx.get(result.schemas, 'Product') as CodegenObjectSchema
	const mixed = idx.get(product.properties!, 'mixed')
	expect(mixed).toBeDefined()

	/* string and integer have no common type, but wrapping keeps each member's own type rather than collapsing */
	expect(isCodegenInterfaceSchema(mixed!.schema)).toBe(true)
	const iface = mixed!.schema as CodegenInterfaceSchema
	expect(iface.implementors!.length).toEqual(2)

	const wrappedTypes = iface.implementors!.map(i => (i as CodegenWrapperSchema).property.schema.schemaType).sort()
	expect(wrappedTypes).toEqual([CodegenSchemaType.INTEGER, CodegenSchemaType.STRING].sort())
})
