import { CodegenEnumSchema, CodegenEnumValues, CodegenLiteralValueOptions, CodegenSchemaType, CodegenScope } from '@openapi-generator-plus/types'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import * as idx from '@openapi-generator-plus/indexed-type'
import { addToScope, extractCodegenSchemaCommon } from './utils'
import { toCodegenSchemaType } from './schema-type'
import { nameFromRef } from '../utils'
import { toUniqueScopedName } from './naming'
import { toCodegenExamples } from '../examples'

export function toCodegenEnumSchema(schema: OpenAPIX.SchemaObject, $ref: string | undefined, suggestedName: string, suggestedScope: CodegenScope | null, state: InternalCodegenState): CodegenEnumSchema {
	if (!schema.enum) {
		throw new Error('Not an enum schema')
	}
	if (typeof schema.type !== 'string') {
		throw new Error(`Invalid schema type for enum schema: ${schema.type}: ${JSON.stringify(schema)}`)
	}

	const { scopedName, scope } = toUniqueScopedName($ref, suggestedName, suggestedScope, schema, state)
	const name = scopedName[scopedName.length - 1]

	const vendorExtensions = toCodegenVendorExtensions(schema)

	const nativeType = state.generator.toNativeObjectType({
		modelNames: scopedName,
		vendorExtensions,
	})

	const enumValueType = 'string'
	const enumValueFormat = schema.format
	const enumValuePropertyType = toCodegenSchemaType(enumValueType, enumValueFormat)

	const enumValueNativeType = state.generator.toNativeType({
		type: enumValueType,
		format: schema.format,
		required: true,
		vendorExtensions,
	})

	const enumValueLiteralOptions: CodegenLiteralValueOptions = {
		type: enumValueType,
		format: enumValueFormat,
		schemaType: enumValuePropertyType,
		nativeType: enumValueNativeType,
		required: true,
	}
	
	const enumValues: CodegenEnumValues = idx.create(schema.enum.map(name => ([`${name}`, {
		name: state.generator.toEnumMemberName(`${name}`),
		literalValue: state.generator.toLiteral(`${name}`, enumValueLiteralOptions),
		value: `${name}`,
	}])))

	const result: CodegenEnumSchema = {
		name,
		serializedName: $ref ? (nameFromRef($ref) || null) : null,
		scopedName,
		schemas: null,

		type: schema.type,
		format: schema.format || null,
		schemaType: CodegenSchemaType.ENUM,
		componentSchema: null,
		nativeType,

		...extractCodegenSchemaCommon(schema, state),

		vendorExtensions,

		enumValueNativeType,
		enumValues,

		examples: null,
	}

	result.examples = toCodegenExamples(schema.example, undefined, undefined, result, state)

	addToScope(result, scope, state)
	return result
}
