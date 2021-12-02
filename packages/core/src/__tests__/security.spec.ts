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
