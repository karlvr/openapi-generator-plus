import { createTestDocument } from './common'
import { CodegenPropertyType } from '@openapi-generator-plus/types'
import { idx } from '../'

test('property conflict resolved', async() => {
	const result = await createTestDocument('all-of-property-conflict-v3.yml')
	const child = idx.get(result.models, 'Child')

	expect(child).toBeDefined()
	expect(child!.properties).toBeDefined()

	const property = idx.get(child!.properties!, 'childName')
	expect(property).toBeDefined()
	expect(property!.propertyType).toEqual(CodegenPropertyType.NUMBER)
})
