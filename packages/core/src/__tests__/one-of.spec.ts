import { createTestDocument } from './common'
import { idx } from '../'
// import util from 'util'
import { CodegenAllOfSchema, CodegenAllOfStrategy, CodegenInterfaceSchema, CodegenNumericSchema, CodegenObjectSchema, CodegenOneOfSchema, CodegenOneOfStrategy, CodegenSchemaType, CodegenWrapperSchema, isCodegenAllOfSchema, isCodegenInterfaceSchema, isCodegenObjectSchema, isCodegenOneOfSchema } from '@openapi-generator-plus/types'
import testGeneratorConstructor from '@openapi-generator-plus/test-generator'
import { constructGenerator, createCodegenDocument, createCodegenInput, createCodegenState } from '..'
import { createGeneratorContext } from '../generators'
import path from 'path'

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
		oneOfStrategy: CodegenOneOfStrategy.INTERFACE,
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
		oneOfStrategy: CodegenOneOfStrategy.INTERFACE,
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
		.rejects.toThrow('Discriminator property "petType" for "MyResponseType" missing in "Cat"')
})

test('oneOf discriminator missing property (object)', async() => {
	await expect(createTestDocument('one-of/one-of-discriminator-missing-property.yml', {
		oneOfStrategy: CodegenOneOfStrategy.INTERFACE,
	}))
		.rejects.toThrow('Discriminator property "petType" for "MyResponseType" missing in "Cat"')
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
		oneOfStrategy: CodegenOneOfStrategy.INTERFACE,
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
		oneOfStrategy: CodegenOneOfStrategy.INTERFACE,
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
		oneOfStrategy: CodegenOneOfStrategy.INTERFACE,
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
	expect(oneOfCoordinates.nativeType.nativeType).toEqual('Polygon.coordinates.array_value_wrapper')

	expect(oneOfCoordinates.property.nativeType.nativeType).toEqual('array array array number')
	expect(oneOfCoordinates.property.schema.schemaType).toEqual(CodegenSchemaType.ARRAY)
})

test('oneOf discriminator with separate allOf (native)', async() => {
	const result = await createTestDocument('one-of/one-of-discriminator-separate-all-of.yml', {
		oneOfStrategy: CodegenOneOfStrategy.NATIVE,
	})

	const child = idx.get(result.schemas, 'Cat') as CodegenObjectSchema
	const parent = idx.get(result.schemas, 'Pet') as CodegenOneOfSchema

	expect(isCodegenAllOfSchema(child)).toBeTruthy()
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

test('oneOf discriminator with separate allOf (object)', async() => {
	const result = await createTestDocument('one-of/one-of-discriminator-separate-all-of.yml', {
		oneOfStrategy: CodegenOneOfStrategy.INTERFACE,
		allOfStrategy: CodegenAllOfStrategy.OBJECT,
	})

	const child = idx.get(result.schemas, 'Cat') as CodegenObjectSchema
	const parent = idx.get(result.schemas, 'Pet') as CodegenInterfaceSchema

	expect(isCodegenObjectSchema(child)).toBeTruthy()
	expect(isCodegenInterfaceSchema(parent)).toBeTruthy()

	expect(child.name).toEqual('Cat')
	expect(child.implements!.length).toBe(2)

	const abstractAnimal = child.implements![0]
	expect(abstractAnimal.schemaType).toEqual(CodegenSchemaType.INTERFACE)
	expect(abstractAnimal.name).toEqual('i_AbstractAnimal')
	/* AbstractAnimal declares the discriminator property, so it keeps it, marked as a discriminator */
	expect(idx.allKeys(abstractAnimal.properties!)).toEqual(['petType'])
	expect(idx.get(abstractAnimal.properties!, 'petType')!.discriminators).toHaveLength(1)

	expect(child.properties).toBeTruthy()
	/* Without inheritance the child declares every property of the interface, including the one
	   that holds the discriminator value */
	expect(idx.allKeys(child.properties!)).toEqual(['petType', 'name'])
	expect(idx.get(child.properties!, 'petType')!.discriminators).toHaveLength(1)
	expect(idx.get(child.properties!, 'petType')!.overrides).toBeTruthy()

	expect(parent.name).toEqual('Pet')
	expect(parent.discriminator!.name).toEqual('petType')
	expect(parent.discriminator!.references.length).toEqual(3)
	expect(parent.children).toBeNull()
})

test('oneOf primitives (native)', async() => {
	const result = await createTestDocument('one-of/one-of-primitives.yml', {
		oneOfStrategy: CodegenOneOfStrategy.NATIVE,
	})
	expect(result).toBeDefined()

	const oneOf = result.schemas['OneOf'] as CodegenOneOfSchema
	expect(oneOf).toBeDefined()
	expect(isCodegenOneOfSchema(oneOf)).toBeTruthy()
	expect(oneOf.schemas).toBeNull() /* As our schemas are refs, even though they're primitive */
	
	expect(oneOf.composes).not.toBeNull()
	const customInteger = oneOf.composes![0] as CodegenNumericSchema
	expect(customInteger.schemaType).toEqual(CodegenSchemaType.INTEGER)
	expect(customInteger.name).toBeNull() /* An integer schema doesn't need a name */
})

test('oneOf primitives (object)', async() => {
	const result = await createTestDocument('one-of/one-of-primitives.yml', {
		oneOfStrategy: CodegenOneOfStrategy.INTERFACE,
	})
	expect(result).toBeDefined()

	const oneOf = result.schemas['OneOf'] as CodegenInterfaceSchema
	expect(oneOf).toBeDefined()
	expect(isCodegenInterfaceSchema(oneOf)).toBeTruthy()
	
	/* We generate wrapper schemas in the oneOf scope */
	expect(oneOf.schemas).not.toBeNull()
	expect(idx.size(oneOf.schemas!)).toBe(3)

	expect(oneOf.implementors).not.toBeNull()
	const customInteger = oneOf.implementors![0] as CodegenWrapperSchema
	expect(customInteger.schemaType).toEqual(CodegenSchemaType.WRAPPER)
	expect(customInteger.name).toEqual('CustomInteger') /* Wrapper schemas can have names, and we want it to have the name we gave it in the spec */
	expect(customInteger.property).toBeDefined()
	expect(customInteger.property.schema.schemaType).toBe(CodegenSchemaType.INTEGER)
	expect(customInteger.property.nullable).toBeFalsy()
})

test('oneOf primitives with nullable', async() => {
	const result = await createTestDocument('one-of/one-of-primitives.yml', {
		oneOfStrategy: CodegenOneOfStrategy.INTERFACE,
	})
	expect(result).toBeDefined()

	const oneOf = result.schemas['OneOf'] as CodegenInterfaceSchema
	expect(isCodegenInterfaceSchema(oneOf)).toBeTruthy()

	expect(oneOf.implementors).not.toBeNull()
	const customIntegerNullable = oneOf.implementors![2] as CodegenWrapperSchema
	expect(customIntegerNullable.schemaType).toEqual(CodegenSchemaType.WRAPPER)
	expect(customIntegerNullable.name).toEqual('CustomIntegerNullable') /* Wrapper schemas can have names, and we want it to have the name we gave it in the spec */
	expect(customIntegerNullable.property).toBeDefined()
	expect(customIntegerNullable.property.nullable).toBeTruthy()
})

test('oneOf allOf (native)', async() => {
	const result = await createTestDocument('one-of/one-of-all-of.yml', {
		oneOfStrategy: CodegenOneOfStrategy.NATIVE,
		allOfStrategy: CodegenAllOfStrategy.NATIVE,
	})
	expect(result).toBeDefined()

	const propertyInfo = result.schemas['PropertyInfo'] as CodegenOneOfSchema
	expect(propertyInfo).toBeDefined()
	expect(isCodegenOneOfSchema(propertyInfo)).toBeTruthy()
	expect(propertyInfo.schemas).toBeNull() /* As our schemas are refs */
	
	expect(propertyInfo.composes).not.toBeNull()
	const integerProperty = propertyInfo.composes![0] as CodegenNumericSchema
	expect(integerProperty.schemaType).toEqual(CodegenSchemaType.ALLOF)
	expect(integerProperty.name).toEqual('IntegerProperty')
})

test('oneOf allOf (object)', async() => {
	const result = await createTestDocument('one-of/one-of-all-of.yml', {
		oneOfStrategy: CodegenOneOfStrategy.INTERFACE,
		allOfStrategy: CodegenAllOfStrategy.OBJECT,
		supportsInheritance: false,
	})
	expect(result).toBeDefined()

	const propertyInfo = result.schemas['PropertyInfo'] as CodegenInterfaceSchema
	expect(propertyInfo).toBeDefined()
	expect(isCodegenInterfaceSchema(propertyInfo)).toBeTruthy()
	expect(propertyInfo.schemas).toBeNull() /* As our schemas are refs */

	expect(propertyInfo.implementors).not.toBeNull()
	const integerProperty = propertyInfo.implementors![0] as CodegenObjectSchema
	expect(integerProperty.schemaType).toEqual(CodegenSchemaType.OBJECT)
	expect(integerProperty.name).toEqual('IntegerProperty')
	expect(integerProperty.implements).toBeTruthy()
	expect(integerProperty.implements?.length).toEqual(2)
	expect(integerProperty.properties).toBeTruthy()
	/* Without inheritance the implementor declares every property of the interface, including the
	   one that holds the discriminator value */
	expect(idx.allKeys(integerProperty.properties!)).toEqual(['type', 'value'])
	expect(idx.get(integerProperty.properties!, 'type')!.discriminators).toHaveLength(1)
	expect(idx.get(integerProperty.properties!, 'type')!.overrides).toBeTruthy()
	expect(integerProperty.discriminatorValues).toBeTruthy()
	expect(integerProperty.discriminatorValues?.length).toEqual(1)
	expect(integerProperty.discriminatorValues![0].schemas[0].discriminator?.serializedName).toEqual('type')

	const objectProperty = propertyInfo.implementors![2] as CodegenObjectSchema
	expect(objectProperty.name).toEqual('ObjectProperty')
	expect(objectProperty.schemaType).toEqual(CodegenSchemaType.OBJECT)
	expect(objectProperty.implements).toBeTruthy()
	expect(objectProperty.implements?.length).toEqual(3) /* Extra interfaces as it couldn't use inheritance */
	/* ObjectProperty could not use inheritance, so it declares the property itself */
	expect(idx.has(objectProperty.properties!, 'type')).toBeTruthy()
	expect(idx.get(objectProperty.properties!, 'type')!.discriminators).toHaveLength(1)

	expect(objectProperty.discriminatorValues).toBeTruthy()
	expect(objectProperty.discriminatorValues?.length).toEqual(1)
	expect(objectProperty.discriminatorValues![0].schemas[0].discriminator?.serializedName).toEqual('type')
})

test('oneOf allOf (object with inheritance)', async() => {
	const result = await createTestDocument('one-of/one-of-all-of.yml', {
		oneOfStrategy: CodegenOneOfStrategy.INTERFACE,
		allOfStrategy: CodegenAllOfStrategy.OBJECT,
		supportsInheritance: true,
	})
	expect(result).toBeDefined()

	const propertyInfo = result.schemas['PropertyInfo'] as CodegenInterfaceSchema
	expect(propertyInfo).toBeDefined()
	expect(isCodegenInterfaceSchema(propertyInfo)).toBeTruthy()
	expect(propertyInfo.schemas).toBeNull() /* As our schemas are refs */

	expect(propertyInfo.implementors).not.toBeNull()

	const integerProperty = propertyInfo.implementors![0] as CodegenObjectSchema
	expect(integerProperty.name).toEqual('IntegerProperty')
	expect(integerProperty.schemaType).toEqual(CodegenSchemaType.OBJECT)
	expect(integerProperty.implements).toBeTruthy()
	expect(integerProperty.implements?.length).toEqual(1)
	expect(integerProperty.parents).toBeTruthy()
	expect(integerProperty.parents!.length).toEqual(1)
	expect(integerProperty.properties).toBeTruthy()
	/* The implementor inherits the property that holds the discriminator value from AbstractProperty */
	expect(idx.allKeys(integerProperty.properties!)).toEqual(['value'])
	
	expect(integerProperty.discriminatorValues).toBeTruthy()
	expect(integerProperty.discriminatorValues?.length).toEqual(1)
	expect(integerProperty.discriminatorValues![0].schemas[0].discriminator?.serializedName).toEqual('type')

	const objectProperty = propertyInfo.implementors![2] as CodegenObjectSchema
	expect(objectProperty.name).toEqual('ObjectProperty')
	expect(objectProperty.schemaType).toEqual(CodegenSchemaType.OBJECT)
	expect(objectProperty.implements).toBeTruthy()
	expect(objectProperty.implements?.length).toEqual(3) /* Extra interfaces as it couldn't use inheritance */
	/* ObjectProperty could not use inheritance, so it declares the property itself */
	expect(idx.has(objectProperty.properties!, 'type')).toBeTruthy()
	expect(idx.get(objectProperty.properties!, 'type')!.discriminators).toHaveLength(1)

	expect(objectProperty.discriminatorValues).toBeTruthy()
	expect(objectProperty.discriminatorValues?.length).toEqual(1)
	expect(objectProperty.discriminatorValues![0].schemas[0].discriminator?.serializedName).toEqual('type')
})

test('oneOf anonymous', async() => {
	const result = await createTestDocument('one-of/one-of-anonymous.yml', {
		oneOfStrategy: CodegenOneOfStrategy.INTERFACE,
		allOfStrategy: CodegenAllOfStrategy.OBJECT,
		supportsInheritance: true,
	})
	expect(result).toBeDefined()

	const subservice = idx.get(result.schemas, 'SubService') as CodegenObjectSchema
	expect(subservice.schemaType).toEqual(CodegenSchemaType.OBJECT)

	expect(subservice.schemas).not.toBeNull()
	expect(idx.size(subservice.schemas!)).toEqual(1)

	const regions = idx.get(subservice.schemas!, 'regions') as CodegenInterfaceSchema
	expect(regions.schemaType).toEqual(CodegenSchemaType.INTERFACE)
})

test('oneOf anonymous (native)', async() => {
	const result = await createTestDocument('one-of/one-of-anonymous.yml', {
		oneOfStrategy: CodegenOneOfStrategy.NATIVE,
		allOfStrategy: CodegenAllOfStrategy.OBJECT,
		supportsInheritance: true,
		supportsMultipleInheritance: true,
	})
	expect(result).toBeDefined()

	const subservice = idx.get(result.schemas, 'SubService') as CodegenObjectSchema
	expect(subservice.schemaType).toEqual(CodegenSchemaType.OBJECT)

	expect(subservice.schemas).not.toBeNull()
	expect(idx.size(subservice.schemas!)).toEqual(1)

	const regions = idx.get(subservice.schemas!, 'regions') as CodegenOneOfSchema
	expect(regions.schemaType).toEqual(CodegenSchemaType.ONEOF)
})

test('oneOf with recursion', async() => {
	const result = await createTestDocument('one-of/one-of-recursive.yml', {
		oneOfStrategy: CodegenOneOfStrategy.INTERFACE,
		supportsInheritance: true,
		supportsMultipleInheritance: true,
	})
	expect(result).toBeDefined()

	const recursiveContainer = idx.get(result.schemas, 'RecursiveContainer') as CodegenObjectSchema
	expect(recursiveContainer.schemaType).toEqual(CodegenSchemaType.OBJECT)
	expect(recursiveContainer.properties).not.toBeNull()
	
	const recursiveItems = idx.get(recursiveContainer.properties!, 'items')
	expect(recursiveItems).toBeTruthy()
	
	const recursiveItemsSchema = recursiveItems!.schema
	expect(recursiveItemsSchema.schemaType).toEqual(CodegenSchemaType.INTERFACE)
	expect(recursiveItemsSchema.scopedName?.length).toBe(1)

	expect(recursiveContainer.schemas).toBeNull()

	const nonRecursiveContainer = idx.get(result.schemas, 'NonRecursiveContainer') as CodegenObjectSchema
	expect(nonRecursiveContainer.schemaType).toEqual(CodegenSchemaType.OBJECT)
	expect(nonRecursiveContainer.properties).not.toBeNull()
	
	const nonRecursiveItems = idx.get(nonRecursiveContainer.properties!, 'items')
	expect(nonRecursiveItems).toBeTruthy()
	
	/* The interface created for the non-recursive container's items should be nested in the NonRecursiveContainer */
	const nonRecursiveItemsSchema = nonRecursiveItems!.schema
	expect(nonRecursiveItemsSchema.schemaType).toEqual(CodegenSchemaType.INTERFACE)
	expect(nonRecursiveItemsSchema.scopedName?.length).toBe(2)

	expect(nonRecursiveContainer.schemas).not.toBeNull()
	expect(idx.size(nonRecursiveContainer.schemas!)).toBe(1)
})

test('oneOf discriminator builds each member literal from its own property type', async() => {
	/* Each member declares its own inline single-value enum for the discriminator property. The literal
	   for each member's discriminator value must be built from that member's own property type (its own
	   enum), not from the discriminator's single common type — otherwise every member's literal would
	   refer to the first member's enum, which does not contain the other members' values. */
	const literalNativeTypes: Record<string, string> = {}
	const generator = constructGenerator({}, createGeneratorContext(), (config, context) => {
		const base = testGeneratorConstructor(config, context)
		return {
			...base,
			toLiteral: (value, options) => {
				if (value === 'item_added' || value === 'item_removed') {
					literalNativeTypes[value] = String(options.nativeType)
				}
				return base.toLiteral(value, options)
			},
		}
	})
	const state = createCodegenState({}, generator)
	const input = await createCodegenInput(path.resolve(__dirname, 'one-of/one-of-discriminator-inline-enums.yml'))
	createCodegenDocument(input, state)

	expect(literalNativeTypes['item_added']).toEqual('EventItemAdded.action_enum')
	expect(literalNativeTypes['item_removed']).toEqual('EventItemRemoved.action_enum')
})

/*
 * A schema that declares a discriminator property keeps it. The schema is a type in its own right,
 * and a caller may reach it outside the discriminator hierarchy, so the property must stay
 * available. See https://github.com/karlvr/openapi-generator-plus-generators/issues/48
 */
test('oneOf discriminator keeps an inherited property in its base (native)', async() => {
	const result = await createTestDocument('one-of/one-of-discriminator-inherited-property.yml', {
		oneOfStrategy: CodegenOneOfStrategy.NATIVE,
	})

	/* IndependentObject declares the property, and SubObject2 inherits it */
	const base = idx.get(result.schemas, 'IndependentObject') as CodegenObjectSchema
	expect(idx.allKeys(base.properties!)).toEqual(['thisProperty', 'otherProperty2'])
	const baseProperty = idx.get(base.properties!, 'thisProperty')!
	expect(baseProperty.required).toBeTruthy()
	expect(baseProperty.discriminators).toHaveLength(1)
	expect(baseProperty.discriminators![0].serializedName).toEqual('thisProperty')
	expect(idx.get(base.properties!, 'otherProperty2')!.discriminators).toBeNull()

	/* The base is not itself a member, so it holds no discriminator and no value */
	expect(base.discriminator).toBeNull()
	expect(base.discriminatorValues).toBeNull()

	/* SubObject2 takes the property from IndependentObject, and holds the value for it */
	const member = idx.get(result.schemas, 'SubObject2') as CodegenAllOfSchema
	expect(isCodegenAllOfSchema(member)).toBeTruthy()
	expect(member.composes.map(c => (c as CodegenObjectSchema).name)).toEqual(['IndependentObject'])
	expect(member.discriminatorValues).toHaveLength(1)

	/* A member that declares the property itself keeps it too, marked */
	const ownMember = idx.get(result.schemas, 'SubObject1') as CodegenObjectSchema
	expect(idx.allKeys(ownMember.properties!)).toEqual(['thisProperty', 'otherProperty1'])
	expect(idx.get(ownMember.properties!, 'thisProperty')!.discriminators).toHaveLength(1)
	expect(ownMember.discriminatorValues).toHaveLength(1)
})

test('oneOf discriminator keeps the property in a base two levels up (native)', async() => {
	const result = await createTestDocument('one-of/one-of-discriminator-inherited-property.yml', {
		oneOfStrategy: CodegenOneOfStrategy.NATIVE,
	})

	/* DeepBase declares the property, and Cat inherits it through MiddleBase */
	const deepBase = idx.get(result.schemas, 'DeepBase') as CodegenObjectSchema
	expect(idx.allKeys(deepBase.properties!)).toEqual(['kind', 'deepProperty'])
	expect(idx.get(deepBase.properties!, 'kind')!.discriminators).toHaveLength(1)

	/* MiddleBase does not declare the property, so it does not gain one */
	const middleBase = idx.get(result.schemas, 'MiddleBase') as CodegenAllOfSchema
	for (const composed of middleBase.composes) {
		const properties = (composed as CodegenObjectSchema).properties
		if (properties && idx.has(properties, 'kind')) {
			expect((composed as CodegenObjectSchema).name).toEqual('DeepBase')
		}
	}

	const cat = idx.get(result.schemas, 'Cat') as CodegenAllOfSchema
	expect(isCodegenAllOfSchema(cat)).toBeTruthy()
	expect(cat.discriminatorValues).toHaveLength(1)
})

test('oneOf discriminator does not add a property to a base that never declared one (native)', async() => {
	const result = await createTestDocument('one-of/one-of-discriminator-inherited-property.yml', {
		oneOfStrategy: CodegenOneOfStrategy.NATIVE,
	})

	/* Each member declares its own action property, so SharedBase never had one */
	const sharedBase = idx.get(result.schemas, 'SharedBase') as CodegenObjectSchema
	expect(idx.allKeys(sharedBase.properties!)).toEqual(['common'])
	expect(idx.has(sharedBase.properties!, 'action')).toBeFalsy()

	/* The member declares the property itself, in the schema it composes with SharedBase */
	const member = idx.get(result.schemas, 'EventItemAdded') as CodegenAllOfSchema
	const declaring = member.composes.find(c => idx.has((c as CodegenObjectSchema).properties!, 'action')) as CodegenObjectSchema
	expect(declaring).toBeTruthy()
	expect(idx.get(declaring.properties!, 'action')!.discriminators).toHaveLength(1)
})

test('oneOf discriminator keeps an inherited property in its base (interface)', async() => {
	const result = await createTestDocument('one-of/one-of-discriminator-inherited-property.yml', {
		oneOfStrategy: CodegenOneOfStrategy.INTERFACE,
		allOfStrategy: CodegenAllOfStrategy.OBJECT,
	})

	const base = idx.get(result.schemas, 'IndependentObject') as CodegenObjectSchema
	expect(idx.allKeys(base.properties!)).toEqual(['thisProperty', 'otherProperty2'])
	expect(idx.get(base.properties!, 'thisProperty')!.discriminators).toHaveLength(1)

	const sharedBase = idx.get(result.schemas, 'SharedBase') as CodegenObjectSchema
	expect(idx.allKeys(sharedBase.properties!)).toEqual(['common'])
})
