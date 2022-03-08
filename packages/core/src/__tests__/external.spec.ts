import { createTestDocument } from './common'
import { idx } from '..'
import { CodegenSchemaType, CodegenObjectSchema } from '@openapi-generator-plus/types'

test('parse petstore v2', async() => {
	const result = await createTestDocument('https://petstore.swagger.io/v2/swagger.json')

	expect(result).toBeDefined()
	const user = idx.get(result.schemas, 'User') as CodegenObjectSchema
	expect(user.schemaType).toBe(CodegenSchemaType.OBJECT)
})
