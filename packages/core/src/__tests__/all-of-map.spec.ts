import { createTestDocument } from './common'
import { CodegenAllOfStrategy, CodegenMapSchema, CodegenObjectSchema, CodegenSchemaType } from '@openapi-generator-plus/types'
import { idx } from '..'

test('allOf map', async() => {
	const result = await createTestDocument('all-of/all-of-map.yml', {
		allOfStrategy: CodegenAllOfStrategy.OBJECT,
		supportsInheritance: true,
	})
	expect(result).toBeDefined()

	const child = idx.get(result.schemas, 'Child') as CodegenObjectSchema
	expect(child).toBeDefined()
	expect(child.schemaType).toEqual(CodegenSchemaType.OBJECT)
	expect(child.parents).toBeTruthy()
	expect(child.parents?.length).toEqual(1)
	expect(child.additionalProperties).toBeTruthy()

	const standalone = idx.get(result.schemas, 'Standalone') as CodegenMapSchema
	expect(standalone).toBeDefined()
	expect(standalone.schemaType).toEqual(CodegenSchemaType.MAP)
})
