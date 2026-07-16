import { createTestDocument } from './common'
import { idx } from '..'
import { CodegenAllOfStrategy, CodegenAnyOfSchema, CodegenArraySchema, CodegenObjectSchema, CodegenOneOfSchema, CodegenSchemaType } from '@openapi-generator-plus/types'
import { findProperty } from '../process/schema/utils'

test('process document', async() => {
	const result = await createTestDocument('openapiv31/simple.yml')
	expect(result).toBeDefined()
})

test('parse Xquik search operation', async() => {
	const result = await createTestDocument('openapiv31/xquik-search.yml')

	expect(result.info.title).toEqual('Xquik API')
	expect(result.servers![0].url).toEqual('https://xquik.com')
	expect(result.securitySchemes).not.toBeNull()
	expect(result.securitySchemes?.[0].name).toEqual('apiKey')
	expect(result.securitySchemes?.[0].in).toEqual('header')
	expect(result.securitySchemes?.[0].paramName).toEqual('x-api-key')

	let operation = undefined
	for (const group of result.groups) {
		for (const candidate of group.operations) {
			if (candidate.name === 'searchTweets') {
				operation = candidate
				break
			}
		}
		if (operation) {
			break
		}
	}
	expect(operation).toBeDefined()
	expect(operation?.path).toEqual('/v1/x/tweets/search')
	expect(operation?.parameters).not.toBeNull()
	expect(idx.allValues(operation!.parameters!).map((parameter: { name: string }) => parameter.name)).toEqual(['q', 'cursor', 'limit'])
	expect(operation?.securityRequirements?.requirements[0].schemes[0].scheme.name).toEqual('apiKey')
	expect(operation?.returnNativeType?.toString()).toEqual('SearchTweetsResponse')
})

test('parse null string', async() => {
	const result = await createTestDocument('openapiv31/simple.yml')

	const schema = idx.get(result.schemas, 'Test2Request') as CodegenObjectSchema
	expect(schema.schemaType).toBe(CodegenSchemaType.OBJECT)

	const nullProp = idx.get(schema.properties!, 'first')
	expect(nullProp?.schema.schemaType).toBe(CodegenSchemaType.STRING)
	expect(nullProp?.nullable).toBeTruthy()
})

test('parse null reference', async() => {
	const result = await createTestDocument('openapiv31/simple.yml')

	const schema = idx.get(result.schemas, 'Test2Response') as CodegenObjectSchema
	expect(schema.schemaType).toBe(CodegenSchemaType.OBJECT)

	const nullProp = idx.get(schema.properties!, 'object')
	expect(nullProp?.schema.schemaType).toBe(CodegenSchemaType.OBJECT)
	expect(nullProp?.nullable).toBeTruthy()
})

test('null property', async() => {
	const result = await createTestDocument('openapiv31/null-property.yml')

	const schema = idx.get(result.schemas, 'TestObject') as CodegenObjectSchema
	expect(schema.schemaType).toBe(CodegenSchemaType.OBJECT)

	/* A property declared as `type: "null"` results in a schema of type NULL, which the generator must support */
	const config = idx.get(schema.properties!, 'config')
	expect(config).toBeDefined()
	expect(config!.schema.schemaType).toBe(CodegenSchemaType.NULL)
})

test('type union', async() => {
	const result = await createTestDocument('openapiv31/type-union.yml')

	const schema = idx.get(result.schemas, 'TestObject') as CodegenObjectSchema
	expect(schema.schemaType).toBe(CodegenSchemaType.OBJECT)

	/* A genuine multi-type union becomes an anyOf of single-type schemas */
	const union = idx.get(schema.properties!, 'union')!
	expect(union.schema.schemaType).toBe(CodegenSchemaType.ANYOF)
	const unionSchema = union.schema as CodegenAnyOfSchema
	const memberTypes = unionSchema.composes.map(m => m.schemaType).sort()
	expect(memberTypes).toEqual([CodegenSchemaType.NUMBER, CodegenSchemaType.STRING].sort())
})

test('nullable type union', async() => {
	const result = await createTestDocument('openapiv31/type-union.yml')

	const schema = idx.get(result.schemas, 'TestObject') as CodegenObjectSchema

	/* A union that also contains "null" is factored into a nullable anyOf of the remaining types */
	const nullableUnion = idx.get(schema.properties!, 'nullableUnion')!
	expect(nullableUnion.nullable).toBe(true)
	expect(nullableUnion.schema.schemaType).toBe(CodegenSchemaType.ANYOF)
	const nullableUnionSchema = nullableUnion.schema as CodegenAnyOfSchema
	expect(nullableUnionSchema.composes.length).toBe(2)
})

test('type union preserves format', async() => {
	const result = await createTestDocument('openapiv31/type-union.yml')

	const schema = idx.get(result.schemas, 'TestObject') as CodegenObjectSchema

	/* The sibling format is carried onto each member so type/format combinations survive */
	const formattedUnion = idx.get(schema.properties!, 'formattedUnion')!
	expect(formattedUnion.schema.schemaType).toBe(CodegenSchemaType.ANYOF)
	const formattedUnionSchema = formattedUnion.schema as CodegenAnyOfSchema
	const integerMember = formattedUnionSchema.composes.find(m => m.schemaType === CodegenSchemaType.INTEGER)!
	expect(integerMember).toBeDefined()
	expect(integerMember.format).toBe('int64')
})

test('required on all-of with incompatible base', async() => {
	const result = await createTestDocument('openapiv31/required-on-all-of.yml', {
		allOfStrategy: CodegenAllOfStrategy.OBJECT,
	})

	const schema = idx.get(result.schemas, 'First') as CodegenObjectSchema
	expect(schema.schemaType).toBe(CodegenSchemaType.OBJECT)

	expect(schema.parents).toBeNull() /* Because it's not compatible due to required on "first" */

	const first = idx.get(schema.properties!, 'first')!
	expect(first).toBeTruthy()
	expect(first.schema.schemaType).toBe(CodegenSchemaType.STRING)
	expect(first.required).toBeTruthy()

	const second = idx.get(schema.properties!, 'second')!
	expect(second).toBeTruthy()
	expect(second.schema.schemaType).toBe(CodegenSchemaType.STRING)
	expect(second.required).toBeTruthy()
})

test('required on all-of base', async() => {
	const result = await createTestDocument('openapiv31/required-on-all-of.yml', {
		allOfStrategy: CodegenAllOfStrategy.OBJECT,
		supportsInheritance: true,
	})

	const schema = idx.get(result.schemas, 'Base') as CodegenObjectSchema
	expect(schema.schemaType).toBe(CodegenSchemaType.OBJECT)

	const first = idx.get(schema.properties!, 'first')!
	expect(first).toBeTruthy()
	expect(first.schema.schemaType).toBe(CodegenSchemaType.STRING)
	expect(first.required).toBeFalsy()
})

test('required on all-of with compatible base', async() => {
	const result = await createTestDocument('openapiv31/required-on-all-of.yml', {
		allOfStrategy: CodegenAllOfStrategy.OBJECT,
		supportsInheritance: true,
	})

	const schema = idx.get(result.schemas, 'Second') as CodegenObjectSchema
	expect(schema.schemaType).toBe(CodegenSchemaType.OBJECT)

	expect(schema.parents).not.toBeNull() /* Because it's compatible due to required on "first" on base */

	const first = findProperty(schema, 'first')!
	expect(first).toBeTruthy()
	expect(first.schema.schemaType).toBe(CodegenSchemaType.STRING)
	expect(first.required).toBeTruthy()

	const second = findProperty(schema, 'second')!
	expect(second).toBeTruthy()
	expect(second.schema.schemaType).toBe(CodegenSchemaType.STRING)
	expect(second.required).toBeTruthy()
})

test('any schema', async() => {
	const result = await createTestDocument('openapiv31/any-schema.yml')
	expect(result).toBeDefined()

	const schema = idx.get(result.schemas, 'TestObject') as CodegenObjectSchema
	expect(schema.schemaType).toBe(CodegenSchemaType.OBJECT)

	const property = idx.get(schema.properties!, 'test')
	expect(property?.schema.schemaType).toBe(CodegenSchemaType.ANY)
})

test('array without items schema', async() => {
	const result = await createTestDocument('openapiv31/array-without-items-schema.yml')
	expect(result).toBeDefined()

	const schema = idx.get(result.schemas, 'TestObject') as CodegenObjectSchema
	expect(schema.schemaType).toBe(CodegenSchemaType.OBJECT)

	const property = idx.get(schema.properties!, 'test')
	expect(property?.schema.schemaType).toBe(CodegenSchemaType.ARRAY)
	
	expect((property?.schema as CodegenArraySchema).component.schema.schemaType).toBe(CodegenSchemaType.ANY)
})

test('oneOf with null member', async() => {
	const result = await createTestDocument('openapiv31/one-of-null.yml')

	const schema = idx.get(result.schemas, 'TestObject') as CodegenObjectSchema

	/* A oneOf of a single member and "null" is equivalent to that member, made nullable, as `oneOf` and `anyOf` are
	   equivalent when the other member is "null"
	 */
	const singleMember = idx.get(schema.properties!, 'singleMember')!
	expect(singleMember.nullable).toBe(true)
	expect(singleMember.schema.schemaType).toBe(CodegenSchemaType.ARRAY)
})

test('oneOf with null member preserves attributes', async() => {
	const result = await createTestDocument('openapiv31/one-of-null.yml')

	const schema = idx.get(result.schemas, 'TestObject') as CodegenObjectSchema

	/* Unwrapping the redundant oneOf preserves the attributes it declared alongside its members */
	const property = idx.get(schema.properties!, 'singleMemberWithAttributes')!
	expect(property.nullable).toBe(true)
	expect(property.schema.schemaType).toBe(CodegenSchemaType.ARRAY)
	expect(property.description).toBe('A description on the oneOf itself')
	expect(property.deprecated).toBe(true)
})

test('oneOf with null member inside allOf', async() => {
	const result = await createTestDocument('openapiv31/one-of-null.yml')

	const schema = idx.get(result.schemas, 'TestObject') as CodegenObjectSchema

	/* A single-member allOf wrapping a nullable oneOf reduces to the oneOf's non-null member */
	const property = idx.get(schema.properties!, 'singleMemberInAllOf')!
	expect(property.nullable).toBe(true)
	expect(property.schema.schemaType).toBe(CodegenSchemaType.ARRAY)
})

test('oneOf with null member and multiple other members', async() => {
	const result = await createTestDocument('openapiv31/one-of-null.yml')

	const schema = idx.get(result.schemas, 'TestObject') as CodegenObjectSchema

	/* A oneOf with more members remains a oneOf of those members, made nullable */
	const property = idx.get(schema.properties!, 'multipleMembers')!
	expect(property.nullable).toBe(true)
	expect(property.schema.schemaType).toBe(CodegenSchemaType.ONEOF)
	expect((property.schema as CodegenOneOfSchema).composes.length).toBe(2)
})

test('oneOf with null member preserves discriminator', async() => {
	const result = await createTestDocument('openapiv31/one-of-null.yml')

	const schema = idx.get(result.schemas, 'TestObject') as CodegenObjectSchema

	/* Factoring out the "null" member leaves the remaining members discriminated as they were */
	const property = idx.get(schema.properties!, 'multipleMembersWithDiscriminator')!
	expect(property.nullable).toBe(true)
	expect(property.schema.schemaType).toBe(CodegenSchemaType.ONEOF)

	const oneOfSchema = property.schema as CodegenOneOfSchema
	expect(oneOfSchema.composes.length).toBe(2)
	expect(oneOfSchema.discriminator).toBeTruthy()
	expect(oneOfSchema.discriminator!.name).toBe('petType')
	expect(oneOfSchema.discriminator!.references.length).toBe(2)
})

test('oneOf without null member is unaffected', async() => {
	const result = await createTestDocument('openapiv31/one-of-null.yml')

	const schema = idx.get(result.schemas, 'TestObject') as CodegenObjectSchema

	const property = idx.get(schema.properties!, 'notNullable')!
	expect(property.nullable).toBeFalsy()
	expect(property.schema.schemaType).toBe(CodegenSchemaType.ONEOF)
	expect((property.schema as CodegenOneOfSchema).composes.length).toBe(2)
})
