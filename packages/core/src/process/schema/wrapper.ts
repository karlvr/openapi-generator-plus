import { CodegenProperty, CodegenSchemaType, CodegenSchemaUsage, CodegenScope, CodegenWrapperSchema } from '@openapi-generator-plus/types'
import { InternalCodegenState } from '../../types'
import { extractCodegenSchemaInfo } from '../utils'
import { extractNaming, toUniqueScopedName, usedSchemaName } from './naming'
import { addToScope } from './utils'

export function createWrapperSchemaUsage(suggestedName: string, scope: CodegenScope | null, property: CodegenProperty, state: InternalCodegenState): CodegenSchemaUsage<CodegenWrapperSchema> {
	const naming = toUniqueScopedName(undefined, suggestedName, scope, undefined, CodegenSchemaType.WRAPPER, state)

	const nativeType = state.generator.toNativeObjectType({
		type: 'object',
		schemaType: CodegenSchemaType.WRAPPER,
		scopedName: naming.scopedName,
		vendorExtensions: null,
	})

	const schema: CodegenWrapperSchema = {
		...extractNaming(naming),
		type: 'object',
		format: null,
		schemaType: CodegenSchemaType.WRAPPER,
		property,
		implements: null,
		description: null,
		title: null,
		vendorExtensions: null,
		externalDocs: null,
		nullable: false,
		readOnly: false,
		writeOnly: false,
		deprecated: false,
		nativeType,
		component: null,
		schemas: null,
		parents: null,
		children: null,
	}

	addToScope(schema, scope, state)
	usedSchemaName(naming.scopedName, state)

	return {
		...extractCodegenSchemaInfo(schema),
		required: false,
		schema,
		examples: null,
		defaultValue: null,
	}
}
