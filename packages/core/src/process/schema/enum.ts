import { CodegenEnumSchema, CodegenEnumValues, CodegenLiteralValueOptions, CodegenLogLevel, CodegenSchemaType } from '@openapi-generator-plus/types'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import * as idx from '@openapi-generator-plus/indexed-type'
import { extractCodegenSchemaCommon } from './utils'
import { toCodegenSchemaType } from './schema-type'
import { extractNaming, ScopedModelInfo } from './naming'
import { toCodegenExamples } from '../examples'
import { toCodegenExternalDocs } from '../external-docs'
import { debugStringify } from '@openapi-generator-plus/utils'

export function toCodegenEnumSchema(apiSchema: OpenAPIX.SchemaObject, naming: ScopedModelInfo | null, state: InternalCodegenState): CodegenEnumSchema {
	if (!apiSchema.enum) {
		throw new Error('Not an enum schema')
	}
	if (typeof apiSchema.type !== 'string') {
		throw new Error(`Invalid schema type for enum schema: ${apiSchema.type}: ${debugStringify(apiSchema)}`)
	}

	const vendorExtensions = toCodegenVendorExtensions(apiSchema)

	if (!naming) {
		// TODO what does an enum look like if it doesn't have a name? can enums be inline in some languages?
		// perhaps in TypeScript that would mean our native type was a disjunction of our enum values?
		// so the generator needs to do that for us.
		// Perhaps that means we don't use toNativeObjectType, but instead a toNativeEnumType, that takes 
		// the enum values as well and can optionally use them to make a type literal?
		throw new Error('enum doesn\'t currently support not being named')
	}
	
	const nativeType = state.generator.toNativeObjectType({
		type: apiSchema.type,
		format: apiSchema.format,
		schemaType: CodegenSchemaType.ENUM,
		scopedName: naming.scopedName,
		vendorExtensions,
	})

	const enumValueType = apiSchema.type
	const enumValueFormat = apiSchema.format
	const enumValuePropertyType = toCodegenSchemaType(enumValueType, enumValueFormat)

	const enumValueNativeType = state.generator.toNativeType({
		type: enumValueType,
		format: apiSchema.format,
		schemaType: enumValuePropertyType,
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
	const enumValues: CodegenEnumValues = idx.create()
	apiSchema.enum.forEach(name => {
		const originalEnumMemberName = state.generator.toEnumMemberName(`${name}`)
		let uniqueName = originalEnumMemberName
		let iterations = 1
		while (existingEnumValueNames.has(uniqueName)) {
			uniqueName = state.generator.toEnumMemberName(`${originalEnumMemberName}_${iterations}`)
			iterations += 1
		}
		existingEnumValueNames.add(uniqueName)

		const literalValue = state.generator.toLiteral(`${name}`, enumValueLiteralOptions)
		if (!literalValue) {
			state.log(CodegenLogLevel.WARN, `Cannot format literal for enum value "${name}" in ${debugStringify(apiSchema)}`)
			return
		}

		idx.set(
			enumValues,
			`${name}`,
			{
				name: uniqueName,
				literalValue,
				value: `${name}`,
			},
		)
	})

	const result: CodegenEnumSchema = {
		...extractNaming(naming),

		type: apiSchema.type,
		format: apiSchema.format || null,
		schemaType: CodegenSchemaType.ENUM,
		component: null,
		nativeType,

		...extractCodegenSchemaCommon(apiSchema, state),

		vendorExtensions,
		externalDocs: toCodegenExternalDocs(apiSchema),

		enumValueNativeType,
		enumValues,

		examples: null,
	}

	result.examples = toCodegenExamples(apiSchema.example, undefined, undefined, result, state)
	return result
}
