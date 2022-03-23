import { CodegenObjectSchema, CodegenSchemaType } from '@openapi-generator-plus/types'
import { createTestDocument } from './common'

test('response reference names nested models', async() => {
	const result = await createTestDocument('references/response.yml')
	const op = result.groups[0].operations[0]
	expect(op).toBeDefined()
	expect(op.responses).not.toBeNull()
	expect(op.responses![200]).toBeDefined()
	expect(op.responses![200].defaultContent).not.toBeNull()
	expect(op.responses![200].defaultContent!.nativeType!.nativeType).toEqual('MyResponse_model')
})

test('external references', async() => {
	const result = await createTestDocument('references/external.yml')
	const op = result.groups[0].operations[0]
	expect(op).toBeDefined()
})

test('external references and discriminators', async() => {
	const result = await createTestDocument('references/external-discriminators.yml')
	const op = result.groups[0].operations[0]
	expect(op).toBeDefined()

	const responseSchema = op.defaultResponse?.defaultContent?.schema as CodegenObjectSchema
	expect(responseSchema).toBeDefined()
	expect(responseSchema.schemaType).toEqual(CodegenSchemaType.OBJECT)

	expect(responseSchema.discriminator).not.toBeNull()

	/* Check that we've found the external schemas that are part of this discriminator */
	expect(responseSchema.discriminator?.references.length).toEqual(2)
})
