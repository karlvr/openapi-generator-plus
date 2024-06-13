import { CodegenSchemaPurpose, CodegenSchemaType, CodegenSchemaUsage, CodegenScope, CodegenWrapperSchema } from '@openapi-generator-plus/types'
import { isOpenAPIReferenceObject } from '../../openapi-type-guards'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { extractCodegenSchemaUsage, nameFromRef } from '../utils'
import { extractNaming, toUniqueScopedName, usedSchemaName } from './naming'
import { createCodegenProperty } from './property'
import { finaliseSchema } from './utils'

/**
 * Create a wrapper schema to wrap a primitive value so it can be used by languages that require an object to hold the value.
 * @param suggestedName 
 * @param scope the scope where the wrapper should exist, this must ALWAYS be provided as wrappers are not shared as they are dependent on their usage (based on a CodegenSchemaUsage)
 * @param wrap 
 * @param wrapApi 
 * @param state 
 * @returns 
 */
export function createWrapperSchemaUsage(suggestedName: string, scope: CodegenScope, wrap: CodegenSchemaUsage, wrapApi: OpenAPIX.SchemaObject, state: InternalCodegenState): CodegenSchemaUsage<CodegenWrapperSchema> {
	const $ref = isOpenAPIReferenceObject(wrapApi) ? wrapApi.$ref : undefined
	if ($ref) {
		/* We update our suggested name from the $ref rather than passing it to `toUniqueScopedName` as if that method sees a $ref it will name us
		   in the global scope, but wrappers are always scoped
		 */
		suggestedName = nameFromRef($ref, state)
	}

	const naming = toUniqueScopedName(undefined, suggestedName, scope, wrapApi, CodegenSchemaType.WRAPPER, CodegenSchemaPurpose.WRAPPER, state)
	
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
		type: wrap.schema.type,
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

	finaliseSchema(schema, naming, state)
	usedSchemaName(naming.scopedName, state)

	return {
		...extractCodegenSchemaUsage(wrap),
		schema,
	}
}
