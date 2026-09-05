import { CodegenObjectSchema, isCodegenObjectSchema } from '@openapi-generator-plus/types'
import { createTestDocument } from './common'
import { idx } from '..'

test('request headers are parameters', async() => {
	const doc = await createTestDocument('parameters/request-headers.yml')

	const getUserOp = doc.groups.flatMap(g => g.operations).find(op => op.name === 'getUser')
	expect(getUserOp).toBeDefined()

	const headerParams = getUserOp!.headerParams
	expect(headerParams).toBeDefined()
	if (!headerParams) return
	const serializedNames = Array.from(idx.values(headerParams)).map(p => p.serializedName)
	expect(serializedNames).toContain('X-Request-Id')
	expect(serializedNames).toContain('X-Client-Version')
})

test('a nullable parameter loses its nullability', async() => {
	const doc = await createTestDocument('parameters/nullable.yml', { expectLogWarnings: true })

	const op = doc.groups.flatMap(g => g.operations).find(op => op.name === 'getTest')
	expect(op).toBeDefined()
	expect(op!.parameters).toBeDefined()

	/* A URL carries text, so it has no null. A nullable parameter schema cannot be honoured, and
	   the parameter reports no nullability. The generator therefore builds no nullable native type
	   for it. */
	for (const name of ['inline', 'viaRef', 'plain']) {
		const param = idx.get(op!.parameters!, name)
		expect(param).toBeDefined()
		expect(param!.nullable).toBe(false)
	}
})

test('a nullable response header loses its nullability', async() => {
	const doc = await createTestDocument('parameters/nullable.yml', { expectLogWarnings: true })

	const op = doc.groups.flatMap(g => g.operations).find(op => op.name === 'getTest')
	const response = idx.get(op!.responses!, '200')
	expect(response).toBeDefined()

	const header = idx.get(response!.headers!, 'X-Nullable')
	expect(header).toBeDefined()
	expect(header!.nullable).toBe(false)
})

test('a nullable property keeps its nullability', async() => {
	const doc = await createTestDocument('parameters/nullable.yml', { expectLogWarnings: true })

	/* Correcting a parameter must not reach the schema, which another usage can share. */
	const schema = idx.get(doc.schemas, 'AnObject')
	expect(schema).toBeDefined()
	expect(isCodegenObjectSchema(schema!)).toBeTruthy()

	const property = idx.get((schema as CodegenObjectSchema).properties!, 'nullableProperty')
	expect(property).toBeDefined()
	expect(property!.nullable).toBe(true)
})
