import { createTestDocument } from './common'
import { CodegenSchemaType } from '@openapi-generator-plus/types'
import { idx } from '../'

test('property conflict resolved', async() => {
	const result = await createTestDocument('all-of-property-conflict-v3.yml')
	const child = idx.get(result.models, 'Child')

	expect(child).not.toBeNull()
	expect(child!.properties).not.toBeNull()

	const property = idx.get(child!.properties!, 'childName')
	expect(property).not.toBeNull()
	expect(property!.schemaType).toEqual(CodegenSchemaType.NUMBER)
})
