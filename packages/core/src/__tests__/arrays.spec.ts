import { createTestDocument } from './common'
import { CodegenObjectSchema, CodegenSchemaType } from '@openapi-generator-plus/types'
import { idx } from '../'

test('naming of inline items', async() => {
	const result = await createTestDocument('arrays/inline-items.yml')

	expect(idx.size(result.models)).toEqual(1)

	const models = idx.allValues(result.models)
	const model1 = models[0]
	expect(model1.name).toEqual('Ford')
	expect(idx.size(model1.properties!)).toEqual(1)
	const model1Properties = idx.allValues(model1.properties!)

	const property = model1Properties![0]
	expect(property.schemaType).toEqual(CodegenSchemaType.ARRAY)
	expect(property.componentSchema).not.toBeNull()
	expect((property.componentSchema as unknown as CodegenObjectSchema).name).toEqual('message_enum')
})
