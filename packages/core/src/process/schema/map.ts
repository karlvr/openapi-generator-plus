import { CodegenMapSchema, CodegenMapTypePurpose, CodegenSchemaPurpose, CodegenSchemaType, CodegenScope } from '@openapi-generator-plus/types'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { toCodegenSchemaUsage } from './index'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { extractCodegenSchemaCommon } from './utils'
import { nameFromRef } from '../utils'

export function toCodegenMapSchema(schema: OpenAPIX.SchemaObject, $ref: string | undefined, suggestedName: string, scope: CodegenScope | null, purpose: CodegenMapTypePurpose, state: InternalCodegenState): CodegenMapSchema {
	if ($ref) {
		/* This schema is a reference, so our item schema shouldn't be nested in whatever parent
		   scope we came from.
		 */
		suggestedName = nameFromRef($ref)
		scope = null
	}

	const vendorExtensions = toCodegenVendorExtensions(schema)
	
	const keyNativeType = state.generator.toNativeType({
		type: 'string',
		required: true,
		vendorExtensions,
	})
	const componentSchemaUsage = toCodegenSchemaUsage(schema.additionalProperties, true, suggestedName, CodegenSchemaPurpose.MAP_VALUE, scope, state)

	const nativeType = state.generator.toNativeMapType({
		keyNativeType,
		componentNativeType: componentSchemaUsage.nativeType,
		vendorExtensions,
		purpose,
	})

	const result: CodegenMapSchema = {
		type: 'object',
		format: schema.format || null,
		schemaType: CodegenSchemaType.MAP,
		componentSchema: componentSchemaUsage.schema,
		nativeType,

		...extractCodegenSchemaCommon(schema, state),
		vendorExtensions,

		maxItems: schema.maxItems || null,
		minItems: schema.minItems || null,
	}
	return result
}
