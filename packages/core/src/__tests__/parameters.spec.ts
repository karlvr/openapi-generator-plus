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
