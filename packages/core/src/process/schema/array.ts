import { CodegenArraySchema, CodegenArrayTypePurpose, CodegenSchemaPurpose, CodegenSchemaType, CodegenScope } from '@openapi-generator-plus/types'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { toCodegenSchemaUsage } from './index'
import { nameFromRef } from '../utils'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { extractCodegenSchemaCommon } from './utils'

export function toCodegenArraySchema(schema: OpenAPIX.SchemaObject, $ref: string | undefined, suggestedItemModelName: string, scope: CodegenScope | null, purpose: CodegenArrayTypePurpose, state: InternalCodegenState): CodegenArraySchema {
	if ($ref) {
		/* This schema is a reference, so our item schema shouldn't be nested in whatever parent
		   scope we came from.
		 */
		suggestedItemModelName = nameFromRef($ref)
		scope = null
	}

	if (schema.type !== 'array') {
		throw new Error('Not an array schema')
	}

	if (!schema.items) {
		throw new Error('items missing for schema type "array"')
	}

	const vendorExtensions = toCodegenVendorExtensions(schema)

	/* Component properties are implicitly required as we don't expect to have `null` entries in the array. */
	const componentSchemaUsage = toCodegenSchemaUsage(schema.items, true, suggestedItemModelName, CodegenSchemaPurpose.ARRAY_ITEM, scope, state)
	const nativeType = state.generator.toNativeArrayType({
		componentNativeType: componentSchemaUsage.nativeType,
		uniqueItems: schema.uniqueItems,
		purpose,
		vendorExtensions,
	})

	const result: CodegenArraySchema = {
		type: 'array',
		format: schema.format || null,
		schemaType: CodegenSchemaType.ARRAY,
		componentSchema: componentSchemaUsage.schema,
		nativeType,

		...extractCodegenSchemaCommon(schema, state),

		vendorExtensions,

		maxItems: schema.maxItems || null,
		minItems: schema.minItems || null,
		uniqueItems: schema.uniqueItems || null,
	}
	return result
}
