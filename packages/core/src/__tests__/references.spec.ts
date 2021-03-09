import { createTestDocument } from './common'

test('response reference names nested models', async() => {
	const result = await createTestDocument('references/response.yml')
	const op = result.groups[0].operations[0]
	expect(op).toBeDefined()
	expect(op.responses).not.toBeNull()
	expect(op.responses![200]).toBeDefined()
	expect(op.responses![200].defaultContent).not.toBeNull()
	expect(op.responses![200].defaultContent!.nativeType.nativeType).toEqual('MyResponse_model')
})

test('external references', async() => {
	const result = await createTestDocument('references/external.yml')
	const op = result.groups[0].operations[0]
	expect(op).toBeDefined()
})
