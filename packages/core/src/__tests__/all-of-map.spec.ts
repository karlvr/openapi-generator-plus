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

	const standaloneSchema = idx.get(result.schemas, 'Standalone') as CodegenMapSchema
	expect(standaloneSchema).not.toBeDefined() /* As we don't add collections as schemas */

	const standaloneApi = result.groups[0].operations[0]
	expect(standaloneApi).toBeDefined()
	expect(standaloneApi.defaultResponse?.defaultContent).toBeDefined()
	
	const standalone = standaloneApi.defaultResponse?.defaultContent?.schema as CodegenMapSchema
	expect(standalone).toBeDefined()
	expect(standalone.schemaType).toEqual(CodegenSchemaType.MAP)
})

test('allOf map and properties', async() => {
	const result = await createTestDocument('all-of/all-of-map-and-properties.yml', {
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
	expect(child.properties).toBeTruthy()
	expect(idx.size(child.properties!)).toEqual(1)
})
