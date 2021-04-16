import { createTestDocument } from './common'
import { CodegenObjectSchema, CodegenSchemaType, isCodegenObjectSchema } from '@openapi-generator-plus/types'
import { idx } from '../'

test('naming of inline items', async() => {
	const result = await createTestDocument('arrays/inline-items.yml')

	expect(idx.size(result.schemas)).toEqual(1)

	const models = idx.allValues(result.schemas)
	const model1 = models[0] as CodegenObjectSchema
	expect(model1).toBeDefined()
	expect(isCodegenObjectSchema(model1)).toBeTruthy()
	expect(model1.name).toEqual('Ford')
	expect(idx.size(model1.properties!)).toEqual(1)
	const model1Properties = idx.allValues(model1.properties!)

	const property = model1Properties![0]
	expect(property.schemaType).toEqual(CodegenSchemaType.ARRAY)
	expect(property.component).not.toBeNull()
	expect((property.component!.schema as unknown as CodegenObjectSchema).name).toEqual('message_enum')
})
