import { createTestDocument } from './common'
import { CodegenAllOfSchema, CodegenAllOfStrategy, CodegenInterfaceSchema, CodegenObjectSchema, CodegenSchemaType, isCodegenInterfaceSchema, isCodegenObjectSchema } from '@openapi-generator-plus/types'
import { idx } from '../'

test('allOf simple (native)', async() => {
	const result = await createTestDocument('all-of/all-of-simple.yml', {
		allOfStrategy: CodegenAllOfStrategy.NATIVE,
	})
	const parent = idx.get(result.schemas, 'Parent') as CodegenObjectSchema
	const child = idx.get(result.schemas, 'Child') as CodegenAllOfSchema
	
	expect(parent).toBeDefined()
	expect(parent.schemaType).toEqual(CodegenSchemaType.OBJECT)
	expect(parent.anonymous).toBe(false)

	expect(child).toBeDefined()
	expect(child.schemaType).toEqual(CodegenSchemaType.ALLOF)
	expect(child.composes).toBeDefined()
	expect(child.composes.length).toEqual(2)
	expect(child.composes[0]).toBe(parent)
	expect(child.composes[1].anonymous).toBe(true)
})

test('allOf simple (object, single)', async() => {
	const result = await createTestDocument('all-of/all-of-simple.yml', {
		allOfStrategy: CodegenAllOfStrategy.OBJECT,
		supportsInheritance: true,
		supportsMultipleInheritance: false,
	})
	const parent = idx.get(result.schemas, 'Parent') as CodegenObjectSchema
	const child = idx.get(result.schemas, 'Child') as CodegenObjectSchema
	
	expect(parent).toBeDefined()
	expect(parent.schemaType).toEqual(CodegenSchemaType.OBJECT)
	expect(parent.anonymous).toBe(false)

	expect(child).toBeDefined()
	expect(child.schemaType).toEqual(CodegenSchemaType.OBJECT)
	expect(child.parents).toBeDefined()
	expect(child.parents!.length).toEqual(1)
	expect(child.parents![0]).toBe(parent)
})

test('allOf simple (object, multi)', async() => {
	const result = await createTestDocument('all-of/all-of-simple.yml', {
		allOfStrategy: CodegenAllOfStrategy.OBJECT,
		supportsInheritance: true,
		supportsMultipleInheritance: true,
	})
	const parent = idx.get(result.schemas, 'Parent') as CodegenObjectSchema
	const child = idx.get(result.schemas, 'Child') as CodegenObjectSchema
	
	expect(parent).toBeDefined()
	expect(parent.schemaType).toEqual(CodegenSchemaType.OBJECT)
	expect(parent.anonymous).toBe(false)

	expect(child).toBeDefined()
	expect(child.schemaType).toEqual(CodegenSchemaType.OBJECT)
	expect(child.parents).toBeDefined()
	expect(child.parents!.length).toEqual(1)
	expect(child.parents![0]).toBe(parent)
})

test('allOf with discriminator (native)', async() => {
	const result = await createTestDocument('all-of/all-of-discriminator.yml', {
		allOfStrategy: CodegenAllOfStrategy.NATIVE,
	})

	const parent = idx.get(result.schemas, 'Pet') as CodegenObjectSchema
	const child = idx.get(result.schemas, 'Cat') as CodegenAllOfSchema

	expect(child.schemaType).toBe(CodegenSchemaType.ALLOF)
	expect(parent.schemaType).toBe(CodegenSchemaType.OBJECT)

	expect(child.name).toEqual('Cat')
	expect(child.discriminator).toBeNull()
	expect(child.discriminatorValues).not.toBeNull()
	expect(child.discriminatorValues!.length).toEqual(1)
	expect(child.discriminatorValues![0].schema).toBe(parent)

	expect(parent.name).toEqual('Pet')
	expect(parent.discriminator!.references.length).toEqual(3)
	expect(parent.properties).toBeNull() /* As the petType property is removed as it's the discriminator */
})

test('allOf with discriminator and base properties (native)', async() => {
	const result = await createTestDocument('all-of/all-of-discriminator-base-properties.yml', {
		allOfStrategy: CodegenAllOfStrategy.NATIVE,
	})

	const parent = idx.get(result.schemas, 'Pet') as CodegenObjectSchema
	expect(parent.properties).toBeTruthy()
	expect(idx.size(parent.properties!)).toEqual(1)
	expect(idx.allKeys(parent.properties!)[0]).toEqual('colour')
})

test('allOf with discriminator (object, single)', async() => {
	const result = await createTestDocument('all-of/all-of-discriminator.yml', {
		allOfStrategy: CodegenAllOfStrategy.OBJECT,
		supportsInheritance: true,
		supportsMultipleInheritance: false,
	})

	const parent = idx.get(result.schemas, 'Pet') as CodegenInterfaceSchema
	const child = idx.get(result.schemas, 'Cat') as CodegenObjectSchema
	const child3 = idx.get(result.schemas, 'Lizard') as CodegenObjectSchema

	expect(isCodegenInterfaceSchema(parent)).toBeTruthy()
	expect(isCodegenObjectSchema(child)).toBeTruthy()
	expect(isCodegenObjectSchema(child3)).toBeTruthy()

	expect(child.name).toEqual('Cat')
	expect(child.abstract).toBeFalsy()
	expect(parent.name).toEqual('Pet')
	expect(parent.children).toBeNull()
	expect(parent.implementors).toBeTruthy()
	expect(parent.implementors!.length).toEqual(1) /* The implementation of the interface */
	expect(parent.implementation).toBeTruthy()
	expect(parent.implementation!.children).toBeTruthy()
	expect(parent.implementation!.children!.length).toEqual(3)
	expect(parent.discriminator!.references.length).toEqual(3)
	expect(parent.properties).toBeNull() /* As the petType property is removed as it's the discriminator */

	expect(child.parents).toBeTruthy() /* The abstract implementation created for the parent */
	expect(child.parents!.length).toEqual(1)
	expect(child.parents![0].schemaType).toEqual(CodegenSchemaType.OBJECT)
	expect(child.parents![0].abstract).toBeTruthy()
	expect(child.parents![0].interface).toBe(parent)
	expect(parent.implementation).toBe(child.parents![0])

	expect(child.implements).toBeNull()
	
	expect(child3.parents).toBeTruthy()
	expect(child3.implements).toBeNull()
})

test('allOf with discriminator and base properties (object, single)', async() => {
	const result = await createTestDocument('all-of/all-of-discriminator-base-properties.yml', {
		allOfStrategy: CodegenAllOfStrategy.OBJECT,
		supportsInheritance: true,
		supportsMultipleInheritance: false,
	})

	const parent = idx.get(result.schemas, 'Pet') as CodegenObjectSchema
	expect(parent.properties).toBeTruthy()
	expect(idx.size(parent.properties!)).toEqual(1)
	expect(idx.allKeys(parent.properties!)[0]).toEqual('colour')
})

test('allOf with discriminator (object, no inheritance)', async() => {
	const result = await createTestDocument('all-of/all-of-discriminator.yml', {
		allOfStrategy: CodegenAllOfStrategy.OBJECT,
		supportsInheritance: false,
	})

	const parent = idx.get(result.schemas, 'Pet') as CodegenInterfaceSchema
	const child = idx.get(result.schemas, 'Cat') as CodegenObjectSchema
	const child3 = idx.get(result.schemas, 'Lizard') as CodegenObjectSchema

	expect(isCodegenInterfaceSchema(parent)).toBeTruthy()
	expect(isCodegenObjectSchema(child)).toBeTruthy()
	expect(isCodegenObjectSchema(child3)).toBeTruthy()

	expect(child.name).toEqual('Cat')
	expect(parent.name).toEqual('Pet')
	expect(parent.children).toBeNull()
	expect(parent.discriminator).toBeTruthy()
	expect(parent.discriminator!.references.length).toEqual(3)
	expect(parent.properties).toBeNull() /* As the petType property is removed as it's the discriminator */

	expect(child.parents).toBeNull()
	expect(child.implements).toBeTruthy()
	expect(child.implements![0]).toBe(parent)
	
	expect(child3.parents).toBeNull()
	expect(child3.implements).toBeTruthy()
	expect(child3.implements![0]).toBe(parent)

	expect(parent.properties).toBeNull() /* As the petType property is removed as it's the discriminator */
	expect(parent.discriminator).toBeTruthy()
})

test('allOf with discriminator and base properties (object, no inheritance)', async() => {
	const result = await createTestDocument('all-of/all-of-discriminator-base-properties.yml', {
		allOfStrategy: CodegenAllOfStrategy.OBJECT,
		supportsInheritance: false,
	})

	const parent = idx.get(result.schemas, 'Pet') as CodegenInterfaceSchema
	expect(parent.schemaType).toEqual(CodegenSchemaType.INTERFACE)
	expect(parent.properties).toBeTruthy()
	expect(idx.size(parent.properties!)).toEqual(1)
	expect(idx.allKeys(parent.properties!)[0]).toEqual('colour')
})

test('allOf with discriminator no properties (object)', async() => {
	const result = await createTestDocument('all-of/all-of-discriminator-no-properties.yml', {
		allOfStrategy: CodegenAllOfStrategy.OBJECT,
		supportsInheritance: true,
	})

	const parent = idx.get(result.schemas, 'Pet') as CodegenInterfaceSchema
	const child = idx.get(result.schemas, 'Cat') as CodegenObjectSchema
	const child3 = idx.get(result.schemas, 'Lizard') as CodegenObjectSchema

	expect(isCodegenObjectSchema(child)).toBeTruthy()
	expect(isCodegenInterfaceSchema(parent)).toBeTruthy()
	expect(isCodegenObjectSchema(child3)).toBeTruthy()

	expect(child.name).toEqual('Cat')
	expect(parent.name).toEqual('Pet')
	expect(parent.children).toBeNull()
	expect(parent.implementors).toBeTruthy()
	expect(parent.implementors!.length).toEqual(1) /* The implementation of the interface */
	expect(parent.implementation).toBeTruthy()
	expect(parent.implementation!.children).toBeTruthy()
	expect(parent.implementation!.children!.length).toEqual(3)
	expect(parent.discriminator!.references.length).toEqual(3)
	expect(parent.discriminator!.references.length).toEqual(3)

	expect(child.parents).toBeTruthy() /* The abstract implementation created for parent */
	expect(child.implements).toBeNull()
	expect(child.parents![0]).toBe(parent.implementation)
	
	expect(child3.parents).toBeTruthy()
	expect(child3.parents![0]).toBe(parent.implementation)
	expect(child3.implements).toBeNull()
})

/**
 * Some of the allOfs have multiple refs, which means we consider whether we
 * can use multiple inheritance.
 */
test('allOf discriminator multiple refs (object, single)', async() => {
	const result = await createTestDocument('all-of/all-of-discriminator-multiple.yml', {
		allOfStrategy: CodegenAllOfStrategy.OBJECT,
		supportsInheritance: true,
		supportsMultipleInheritance: false,
	})
	expect(result).toBeDefined()

	const base = idx.get(result.schemas, 'Pet') as CodegenInterfaceSchema
	expect(base).toBeDefined()
	expect(base.schemaType).toEqual(CodegenSchemaType.INTERFACE)
	expect(base.discriminator).not.toBeNull()
	expect(base.discriminator!.references.length).toEqual(3)
	expect(base.implementation).toBeTruthy()
	
	const childWithMultipleRefs = idx.get(result.schemas, 'Cat') as CodegenObjectSchema
	expect(childWithMultipleRefs).toBeDefined()
	/* Because one of the allOfs has a discriminator we choose to use it as a parent */
	expect(childWithMultipleRefs.parents).toBeTruthy()
	expect(childWithMultipleRefs.parents![0]).toBe(base.implementation)
	expect(childWithMultipleRefs.implements).not.toBeNull()
	expect(childWithMultipleRefs.discriminator).toBeNull()
	expect(childWithMultipleRefs.discriminatorValues).not.toBeNull()

	const childWithSingleRef = idx.get(result.schemas, 'Lizard') as CodegenObjectSchema
	expect(childWithSingleRef).toBeDefined()
	expect(childWithSingleRef.parents).toBeTruthy() /* The abstract implementation created for base */
	expect(childWithSingleRef.parents![0]).toBe(base.implementation)
	expect(childWithSingleRef.implements).toBeNull()
	expect(childWithSingleRef.discriminator).toBeNull()
	expect(childWithSingleRef.discriminatorValues).not.toBeNull()
})

test('allOf multiple discriminator multiple refs (object, single)', async() => {
	const result = await createTestDocument('all-of/all-of-multiple-discriminator-multiple.yml', {
		allOfStrategy: CodegenAllOfStrategy.OBJECT,
		supportsInheritance: true,
		supportsMultipleInheritance: false,
	})
	expect(result).toBeDefined()

	const base = idx.get(result.schemas, 'Pet') as CodegenInterfaceSchema
	expect(base).toBeDefined()
	expect(base.schemaType).toEqual(CodegenSchemaType.INTERFACE)
	expect(base.discriminator).not.toBeNull()
	expect(base.discriminator!.references.length).toEqual(3)
	expect(base.implementation).toBeTruthy()
	
	const childWithMultipleRefs = idx.get(result.schemas, 'Cat') as CodegenObjectSchema
	expect(childWithMultipleRefs).toBeDefined()
	/* Because _both_ of the allOfs have a discriminator we don't choose either as a parent */
	expect(childWithMultipleRefs.parents).toBeNull()
	expect(childWithMultipleRefs.implements).not.toBeNull()
	expect(childWithMultipleRefs.implements![0]).toBe(base)
	expect(childWithMultipleRefs.discriminator).toBeNull()
	expect(childWithMultipleRefs.discriminatorValues).not.toBeNull()

	const childWithSingleRef = idx.get(result.schemas, 'Lizard') as CodegenObjectSchema
	expect(childWithSingleRef).toBeDefined()
	expect(childWithSingleRef.parents).toBeTruthy() /* The abstract implementation created for base */
	expect(childWithSingleRef.parents![0]).toBe(base.implementation)
	expect(childWithSingleRef.implements).toBeNull()
	expect(childWithSingleRef.discriminator).toBeNull()
	expect(childWithSingleRef.discriminatorValues).not.toBeNull()
})

test('allOf multiple refs (object, single)', async() => {
	const result = await createTestDocument('all-of/all-of-multiple.yml', {
		allOfStrategy: CodegenAllOfStrategy.OBJECT,
		supportsInheritance: true,
		supportsMultipleInheritance: false,
	})
	expect(result).toBeDefined()

	const base = idx.get(result.schemas, 'Pet') as CodegenObjectSchema
	expect(base).toBeDefined()
	expect(base.schemaType).toEqual(CodegenSchemaType.OBJECT)
	expect(base.discriminator).toBeNull()
	expect(base.interface).toBeTruthy()
	
	const childWithMultipleRefs = idx.get(result.schemas, 'Cat') as CodegenObjectSchema
	expect(childWithMultipleRefs).toBeDefined()
	expect(childWithMultipleRefs.parents).toBeNull()
	expect(childWithMultipleRefs.implements).not.toBeNull()
	expect(childWithMultipleRefs.implements![0]).toBe(base.interface)
	expect(childWithMultipleRefs.discriminator).toBeNull()
	expect(childWithMultipleRefs.discriminatorValues).toBeNull()

	const childWithSingleRef = idx.get(result.schemas, 'Lizard') as CodegenObjectSchema
	expect(childWithSingleRef).toBeDefined()
	expect(childWithSingleRef.parents).toBeTruthy()
	expect(childWithSingleRef.parents![0]).toBe(base)
	expect(childWithSingleRef.implements).toBeNull()
	expect(childWithSingleRef.discriminator).toBeNull()
	expect(childWithSingleRef.discriminatorValues).toBeNull()
})

test('allOf discriminator multiple refs (object, multi)', async() => {
	const result = await createTestDocument('all-of/all-of-discriminator-multiple.yml', {
		allOfStrategy: CodegenAllOfStrategy.OBJECT,
		supportsInheritance: true,
		supportsMultipleInheritance: true,
	})
	expect(result).toBeDefined()

	const base = idx.get(result.schemas, 'Pet') as CodegenObjectSchema
	expect(base).toBeDefined()
	expect(isCodegenObjectSchema(base)).toBeTruthy()
	expect(base.discriminator).not.toBeNull()
	expect(base.discriminator!.references.length).toEqual(3)
	
	const childWithMultipleRefs = idx.get(result.schemas, 'Cat') as CodegenObjectSchema
	expect(childWithMultipleRefs).toBeDefined()
	expect(childWithMultipleRefs.parents).not.toBeNull()
	expect(childWithMultipleRefs.implements).toBeNull()

	const childWithSingleRef = idx.get(result.schemas, 'Lizard') as CodegenObjectSchema
	expect(childWithSingleRef).toBeDefined()
	expect(childWithSingleRef.parents).not.toBeNull()
	expect(childWithSingleRef.implements).toBeNull()

	expect(childWithMultipleRefs.discriminator).toBeNull()
	expect(childWithMultipleRefs.discriminatorValues).not.toBeNull()
	expect(childWithSingleRef.discriminator).toBeNull()
	expect(childWithSingleRef.discriminatorValues).not.toBeNull()
})

test('property conflict resolved', async() => {
	const result = await createTestDocument('all-of/all-of-property-conflict-v3.yml', {
		allOfStrategy: CodegenAllOfStrategy.OBJECT,
	})
	const child = idx.get(result.schemas, 'Child') as CodegenObjectSchema
	
	expect(child).toBeDefined()
	expect(isCodegenObjectSchema(child)).toBeTruthy()
	expect(child!.properties).not.toBeNull()

	const property = idx.get(child!.properties!, 'childName')
	expect(property).toBeDefined()
	expect(property!.schema.schemaType).toEqual(CodegenSchemaType.INTEGER)
})

test('parent property no conflict', async() => {
	const result = await createTestDocument('all-of/all-of-parent-property-conflict-v3.yml', {
		allOfStrategy: CodegenAllOfStrategy.OBJECT,
		supportsInheritance: true,
	})
	const child = idx.get(result.schemas, 'ControlChild') as CodegenObjectSchema
	
	expect(child).toBeDefined()
	expect(isCodegenObjectSchema(child)).toBeTruthy()
	expect(child!.properties).not.toBeNull()

	const property = idx.get(child!.properties!, 'name')
	expect(property).toBeDefined()
	expect(property!.schema.schemaType).toEqual(CodegenSchemaType.STRING)

	expect(child.parents).not.toBeNull()
})

test('parent property no conflict (no inheritance)', async() => {
	const result = await createTestDocument('all-of/all-of-parent-property-conflict-v3.yml', {
		allOfStrategy: CodegenAllOfStrategy.OBJECT,
		supportsInheritance: false,
	})
	const child = idx.get(result.schemas, 'ControlChild') as CodegenObjectSchema
	
	expect(child).toBeDefined()
	expect(isCodegenObjectSchema(child)).toBeTruthy()
	expect(child!.properties).not.toBeNull()

	const property = idx.get(child!.properties!, 'name')
	expect(property).toBeDefined()
	expect(property!.schema.schemaType).toEqual(CodegenSchemaType.STRING)

	expect(child.implements).not.toBeNull()
})

test('parent property type conflict resolved', async() => {
	const result = await createTestDocument('all-of/all-of-parent-property-conflict-v3.yml', {
		allOfStrategy: CodegenAllOfStrategy.OBJECT,
		supportsInheritance: true,
	})
	const child = idx.get(result.schemas, 'Child') as CodegenObjectSchema
	
	expect(child).toBeDefined()
	expect(isCodegenObjectSchema(child)).toBeTruthy()
	expect(child!.properties).not.toBeNull()

	const property = idx.get(child!.properties!, 'name')
	expect(property).toBeDefined()
	expect(property!.schema.schemaType).toEqual(CodegenSchemaType.INTEGER) /* integer overrode string */

	/* Our child cannot have parents as it cannot use inheritance because the property types of "name" are incompatible */
	expect(child.parents).toBeNull()
	/* For the same reason, it cannot have interface compatibility */
	expect(child.implements).toBeNull()
})

test('parent property type conflict resolved (no inheritance)', async() => {
	const result = await createTestDocument('all-of/all-of-parent-property-conflict-v3.yml', {
		allOfStrategy: CodegenAllOfStrategy.OBJECT,
		supportsInheritance: false,
	})
	const child = idx.get(result.schemas, 'Child') as CodegenObjectSchema
	
	expect(child).toBeDefined()
	expect(isCodegenObjectSchema(child)).toBeTruthy()
	expect(child!.properties).not.toBeNull()

	const property = idx.get(child!.properties!, 'name')
	expect(property).toBeDefined()
	expect(property!.schema.schemaType).toEqual(CodegenSchemaType.INTEGER) /* integer overrode string */

	/* Our child cannot have parents as it cannot use inheritance because the property types of "name" are incompatible */
	expect(child.parents).toBeNull()
	/* For the same reason, it cannot have interface compatibility */
	expect(child.implements).toBeNull()
})

test('parent property nullability conflict resolved', async() => {
	const result = await createTestDocument('all-of/all-of-parent-property-conflict-v3.yml', {
		allOfStrategy: CodegenAllOfStrategy.OBJECT,
		supportsInheritance: true,
	})
	const child = idx.get(result.schemas, 'Child2') as CodegenObjectSchema
	
	expect(child).toBeDefined()
	expect(isCodegenObjectSchema(child)).toBeTruthy()
	expect(child!.properties).not.toBeNull()

	const property = idx.get(child!.properties!, 'name')
	expect(property).toBeDefined()
	expect(property!.schema.schemaType).toEqual(CodegenSchemaType.STRING)

	/* Our child cannot have parents as it cannot use inheritance because the property types of "name" are incompatible */
	expect(child.parents).toBeNull()
	/* For the same reason, it cannot have interface compatibility */
	expect(child.implements).toBeNull()
})

/**
 * This test also tests serializedName on discriminators
 */
test('allOf discriminator with mapping', async() => {
	const result = await createTestDocument('all-of/all-of-discriminator-mapping.yml', {
		allOfStrategy: CodegenAllOfStrategy.OBJECT,
	})
	expect(result).toBeTruthy()
})

test('allOf allOf native', async() => {
	const result = await createTestDocument('all-of/all-of-all-of.yml', {
		allOfStrategy: CodegenAllOfStrategy.NATIVE,
	})
	expect(result).toBeTruthy()
})

test('allOf allOf object', async() => {
	const result = await createTestDocument('all-of/all-of-all-of.yml', {
		allOfStrategy: CodegenAllOfStrategy.OBJECT,
	})

	const child = idx.get(result.schemas, 'Child') as CodegenObjectSchema
	expect(child.schemaType).toBe(CodegenSchemaType.OBJECT)
	expect(child.parents).toBeNull()
	expect(child.implements).toBeTruthy()
	expect(child.implements?.length).toEqual(2)
	expect(child.implements![0].name).toEqual('i_Parent')
	expect(child.implements![1].name).toEqual('i_GrandChild')

	const grandChild = child.implements![1]
	expect(grandChild.implementation).toBeTruthy()

	const grandChildImpl = grandChild.implementation as CodegenObjectSchema
	expect(grandChildImpl.schemaType).toBe(CodegenSchemaType.OBJECT)
	expect(grandChildImpl.name).toEqual('GrandChild')

	expect(grandChildImpl.interface).toBe(grandChild)
	expect(grandChildImpl.implements).toBeTruthy()
	expect(grandChildImpl.implements?.length).toEqual(3)
})
