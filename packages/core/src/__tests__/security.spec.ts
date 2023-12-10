import { createTestDocument } from './common'

test('security schema vendor extensions', async() => {
	const result = await createTestDocument('security/security-x-session.yml')

	expect(result.securitySchemes).not.toBeNull()
	expect(result.securitySchemes?.length).toEqual(1)
	const scheme = result.securitySchemes![0]
	expect(scheme.scheme).toEqual('basic')
	expect(scheme.vendorExtensions).not.toBeNull()
	expect(scheme.vendorExtensions!['x-session']).toBeDefined()
	expect(scheme.vendorExtensions!['x-session']).toBe(false)
})

test('global security', async() => {
	const result = await createTestDocument('security/security-global.yml')
	expect(result.securitySchemes).not.toBeNull()
	expect(result.securitySchemes?.length).toEqual(2)

	const op = result.groups[0].operations[0]
	expect(op).toBeTruthy()

	expect(op.securityRequirements).toBeTruthy()
	expect(op.securityRequirements?.requirements.length).toBe(1)
	expect(op.securityRequirements?.requirements[0].schemes[0].scheme.name).toEqual('test_auth')

	const op2 = result.groups[0].operations[1]
	expect(op2).toBeTruthy()

	expect(op2.securityRequirements).toBeTruthy()
	expect(op2.securityRequirements?.requirements[0].schemes[0].scheme.name).toEqual('test_auth2')
})
