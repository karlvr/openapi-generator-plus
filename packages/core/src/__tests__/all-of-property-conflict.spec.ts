import { createTestDocument } from './common'

test('property conflict detected', async() => {
	await expect(createTestDocument('all-of-property-conflict-v3.yml'))
		.rejects.toThrow('Cannot merge properties')
})
