import { CodegenObjectSchema } from '@openapi-generator-plus/types'
import { createTestDocument } from './common'

test('response reference is named appropriately', async() => {
	const result = await createTestDocument('naming/response-schema-naming.yml')
	const op1 = result.groups[0].operations[0]
	const op2 = result.groups[1].operations[0]
	expect(op1).toBeDefined()
	expect(op2).toBeDefined()
	expect(op1.fullPath).toEqual('/test1')
	expect(op2.fullPath).toEqual('/test2')
	expect(op1.responses).not.toBeNull()
	expect(op1.responses![200]).toBeDefined()
	expect(op1.responses![200].defaultContent).not.toBeNull()
	expect(op1.responses![200].defaultContent!.nativeType!.nativeType).toEqual(op2.responses![200].defaultContent!.nativeType!.nativeType)
})

test('external object schema is named appropriately', async() => {
	const result = await createTestDocument('naming/external-object-schema.yml')
	const op1 = result.groups[0].operations[0]
	expect(op1).toBeDefined()
	expect(op1.fullPath).toEqual('/test1')
	expect(op1.responses).not.toBeNull()
	expect(op1.responses![200]).toBeDefined()
	expect(op1.responses![200].defaultContent).not.toBeNull()
	expect(op1.responses![200].defaultContent!.nativeType!.nativeType).toEqual('MyExternalSchema') // TODO why doesn't end in _model?
})

test('external response is named appropriately', async() => {
	const result = await createTestDocument('naming/external-response.yml')
	const op1 = result.groups[0].operations[0]
	expect(op1).toBeDefined()
	expect(op1.fullPath).toEqual('/test1')
	expect(op1.responses).not.toBeNull()
	expect(op1.responses![200]).toBeDefined()
	expect(op1.responses![200].defaultContent).not.toBeNull()
	expect(op1.responses![200].defaultContent!.nativeType!.nativeType).toEqual('MyResponse_model')
})

test('external nested response is named appropriately', async() => {
	const result = await createTestDocument('naming/external-nested-response.yml')
	const op1 = result.groups[0].operations[0]
	expect(op1).toBeDefined()
	expect(op1.fullPath).toEqual('/test1')
	expect(op1.responses).not.toBeNull()
	expect(op1.responses![200]).toBeDefined()
	expect(op1.responses![200].defaultContent).not.toBeNull()
	expect(op1.responses![200].defaultContent!.nativeType!.nativeType).toEqual('GET /test-part operation_200_response_model')
})

test('external nested response schema is named appropriately', async() => {
	const result = await createTestDocument('naming/external-nested-response-schema.yml')
	const op1 = result.groups[0].operations[0]
	expect(op1).toBeDefined()
	expect(op1.fullPath).toEqual('/test1')
	expect(op1.responses).not.toBeNull()
	expect(op1.responses![200]).toBeDefined()
	expect(op1.responses![200].defaultContent).not.toBeNull()
	expect(op1.responses![200].defaultContent!.nativeType!.nativeType).toEqual('GET /test-part operation_200_response_model')
})

test('external object schema with reference works', async() => {
	const result = await createTestDocument('naming/external-object-schema-with-reference.yml')
	const op1 = result.groups[0].operations[0]
	expect(op1).toBeDefined()
	expect(op1.fullPath).toEqual('/test1')
	expect(op1.responses).not.toBeNull()

	const response = op1.responses![200]
	expect(response).toBeDefined()
	
	const content = response.defaultContent
	expect(content).not.toBeNull()
	expect(content!.nativeType!.nativeType).toEqual('MyExternalSchemaWithReference') // TODO why doesn't end in _model?
	const objectSchema = content!.schema as CodegenObjectSchema
	expect(objectSchema).toBeTruthy()

	const externalProperty = objectSchema.properties!['testReference']
	expect(externalProperty).toBeDefined()
	expect(externalProperty.nativeType.nativeType).toEqual('MyExternalSchema') // TODO why doesn't end in _model?
})
