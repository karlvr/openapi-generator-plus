import { CodegenEnumSchema, CodegenEnumValues, CodegenLiteralValueOptions, CodegenSchemaType } from '@openapi-generator-plus/types'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import * as idx from '@openapi-generator-plus/indexed-type'
import { extractCodegenSchemaCommon } from './utils'
import { toCodegenSchemaType } from './schema-type'
import { extractNaming, ScopedModelInfo } from './naming'
import { toCodegenExamples } from '../examples'

export function toCodegenEnumSchema(schema: OpenAPIX.SchemaObject, naming: ScopedModelInfo | null, state: InternalCodegenState): CodegenEnumSchema {
	if (!schema.enum) {
		throw new Error('Not an enum schema')
	}
	if (typeof schema.type !== 'string') {
		throw new Error(`Invalid schema type for enum schema: ${schema.type}: ${JSON.stringify(schema)}`)
	}

	const vendorExtensions = toCodegenVendorExtensions(schema)

	if (!naming) {
		// TODO what does an enum look like if it doesn't have a name? can enums be inline in some languages?
		// perhaps in TypeScript that would mean our native type was a disjunction of our enum values?
		// so the generator needs to do that for us.
		// Perhaps that means we don't use toNativeObjectType, but instead a toNativeEnumType, that takes 
		// the enum values as well and can optionally use them to make a type literal?
		throw new Error('enum doesn\'t currently support not being named')
	}
	
	const nativeType = state.generator.toNativeObjectType({
		type: schema.type,
		format: schema.format,
		scopedName: naming.scopedName,
		vendorExtensions,
	})

	const enumValueType = schema.type
	const enumValueFormat = schema.format
	const enumValuePropertyType = toCodegenSchemaType(enumValueType, enumValueFormat)

	const enumValueNativeType = state.generator.toNativeType({
		type: enumValueType,
		format: schema.format,
		vendorExtensions,
	})

	const enumValueLiteralOptions: CodegenLiteralValueOptions = {
		type: enumValueType,
		format: enumValueFormat,
		schemaType: enumValuePropertyType,
		nativeType: enumValueNativeType,
		component: null,
		required: true,
		nullable: false,
		readOnly: false,
		writeOnly: false,
	}
	
	const existingEnumValueNames = new Set<string>()
	const enumValues: CodegenEnumValues = idx.create(schema.enum.map(name => {
		let uniqueName = state.generator.toEnumMemberName(`${name}`)
		let iterations = 1
		while (existingEnumValueNames.has(uniqueName)) {
			uniqueName = state.generator.toEnumMemberName(`${name}_${iterations}`)
			iterations += 1
		}
		existingEnumValueNames.add(uniqueName)

		return ([
			`${name}`,
			{
				name: uniqueName,
				literalValue: state.generator.toLiteral(`${name}`, enumValueLiteralOptions),
				value: `${name}`,
			},
		])
	}))

	const result: CodegenEnumSchema = {
		...extractNaming(naming),

		type: schema.type,
		format: schema.format || null,
		schemaType: CodegenSchemaType.ENUM,
		component: null,
		nativeType,

		...extractCodegenSchemaCommon(schema, state),

		vendorExtensions,

		enumValueNativeType,
		enumValues,

		examples: null,
	}

	result.examples = toCodegenExamples(schema.example, undefined, undefined, result, state)
	return result
}
