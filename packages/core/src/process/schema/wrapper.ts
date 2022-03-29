import { CodegenSchemaType, CodegenSchemaUsage, CodegenScope, CodegenWrapperSchema } from '@openapi-generator-plus/types'
import { isOpenAPIReferenceObject } from '../../openapi-type-guards'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { extractCodegenSchemaUsage } from '../utils'
import { extractNaming, toUniqueScopedName, usedSchemaName } from './naming'
import { createCodegenProperty } from './property'
import { addToScope } from './utils'

export function createWrapperSchemaUsage(suggestedName: string, scope: CodegenScope | null, wrap: CodegenSchemaUsage, wrapApi: OpenAPIX.SchemaObject, state: InternalCodegenState): CodegenSchemaUsage<CodegenWrapperSchema> {
	const $ref = isOpenAPIReferenceObject(wrapApi) ? wrapApi.$ref : undefined
	const naming = toUniqueScopedName($ref, `${suggestedName}_wrapper`, scope, wrapApi, CodegenSchemaType.WRAPPER, state)

	const property = createCodegenProperty('value', wrap, state)
	property.required = true
	property.nullable = wrap.nullable

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
		...extractCodegenSchemaUsage(wrap),
		schema,
	}
}
