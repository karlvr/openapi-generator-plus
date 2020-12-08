import { createTestDocument } from './common'
import { CodegenObjectSchema, CodegenSchemaType, isCodegenObjectSchema } from '@openapi-generator-plus/types'
import { idx } from '../'

test('property conflict resolved', async() => {
	const result = await createTestDocument('all-of-property-conflict-v3.yml')
	const child = idx.get(result.schemas, 'Child') as CodegenObjectSchema
	
	expect(child).toBeDefined()
	expect(isCodegenObjectSchema(child)).toBeTruthy()
	expect(child!.properties).not.toBeNull()

	const property = idx.get(child!.properties!, 'childName')
	expect(property).toBeDefined()
	expect(property!.schemaType).toEqual(CodegenSchemaType.INTEGER)
})
