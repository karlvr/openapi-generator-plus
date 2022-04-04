import { CodegenAllOfStrategy, CodegenOneOfStrategy } from '@openapi-generator-plus/types'
import { createTestDocument } from './common'
import { idx } from '..'

test('toSchemaName doesn\'t impact abstract classes', async() => {
	const result = await createTestDocument('schema-name/schema-name-abstract-implementation.yml', {
		toSchemaName: (name) => `prefix_${name}_suffix`,
		oneOfStrategy: CodegenOneOfStrategy.INTERFACE,
		supportsInheritance: true,
		supportsMultipleInheritance: false,
		allOfStrategy: CodegenAllOfStrategy.OBJECT,
	})

	const schemaNames = idx.allKeys(result.schemas).sort()
	expect(schemaNames).toEqual(['prefix_BaseSchema_model_suffix', 'prefix_BaseSchema_suffix', 'prefix_SchemaOne_suffix', 'prefix_SchemaTwo_suffix'])
})
