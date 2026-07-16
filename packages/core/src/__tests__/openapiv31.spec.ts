import { createTestDocument } from './common'
import { idx } from '..'
import { CodegenAllOfStrategy, CodegenAnyOfSchema, CodegenArraySchema, CodegenObjectSchema, CodegenSchemaType } from '@openapi-generator-plus/types'
import { findProperty } from '../process/schema/utils'

test('process document', async() => {
	const result = await createTestDocument('openapiv31/simple.yml')
	expect(result).toBeDefined()
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
