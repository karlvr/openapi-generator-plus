import { CodegenEnumSchema, CodegenEnumValues, CodegenLiteralValueOptions, CodegenLogLevel, CodegenSchemaPurpose, CodegenSchemaType, CodegenVendorExtensions } from '@openapi-generator-plus/types'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import * as idx from '@openapi-generator-plus/indexed-type'
import { extractCodegenSchemaCommon, finaliseSchema } from './utils'
import { toCodegenSchemaType } from './schema-type'
import { extractNaming, ScopedModelInfo } from './naming'
import { toCodegenExamples } from '../examples'
import { toCodegenExternalDocs } from '../external-docs'
import { debugStringify } from '@openapi-generator-plus/utils'
import { SchemaOptions } from '.'

export function toCodegenEnumSchema(apiSchema: OpenAPIX.SchemaObject, options: SchemaOptions, state: InternalCodegenState): CodegenEnumSchema {
	const { naming, purpose } = options
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

	const enumValueType = apiSchema.type
	const enumValueFormat = apiSchema.format
	
	const nativeType = state.generator.toNativeObjectType({
		type: enumValueType,
		format: enumValueFormat,
		purpose,
		schemaType: CodegenSchemaType.ENUM,
		scopedName: naming.scopedName,
		vendorExtensions,
	})

	const enumValuePropertyType = toCodegenSchemaType(enumValueType, enumValueFormat)

	const enumValueNativeType = state.generator.toNativeType({
		type: enumValueType,
		format: apiSchema.format,
		purpose,
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
	
	const enumValueDescriptions = toEnumValueDescriptions(vendorExtensions, apiSchema.enum, apiSchema, state)

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
				description: enumValueDescriptions[`${name}`] ?? null,
			},
		)
	})

	const result: CodegenEnumSchema = {
		...extractNaming(naming),

		type: apiSchema.type,
		format: apiSchema.format || null,
		purpose,
		schemaType: CodegenSchemaType.ENUM,
		contentMediaType: null,
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

	finaliseSchema(result, naming, state)
	return result
}

/**
 * Extract descriptions for individual enum values from the `x-enum-descriptions` vendor extension, returning them
 * keyed by the (stringified) enum value.
 * <p>
 * Two forms of the extension are supported:
 * <ul>
 * <li>An array of descriptions positionally aligned with the enum values.
 * <li>An object keyed by enum value, whose values are either a description string or an object with a `description`
 *     property.
 * </ul>
 * Entries that don't correspond to an enum value, or that aren't in a recognised form, are ignored with a warning.
 */
function toEnumValueDescriptions(vendorExtensions: CodegenVendorExtensions | null, enumValues: unknown[], apiSchema: OpenAPIX.SchemaObject, state: InternalCodegenState): Record<string, string> {
	const result: Record<string, string> = {}
	if (!vendorExtensions) {
		return result
	}

	const ext = vendorExtensions['x-enum-descriptions']
	if (!ext) {
		return result
	}

	const stringValues = enumValues.map(value => `${value}`)

	if (Array.isArray(ext)) {
		/* An array of descriptions positionally aligned with the enum values */
		if (ext.length > stringValues.length) {
			state.log(CodegenLogLevel.WARN, `x-enum-descriptions has more entries (${ext.length}) than enum values (${stringValues.length}) in ${debugStringify(apiSchema)}`)
		}
		ext.forEach((entry, i) => {
			if (i >= stringValues.length) {
				return
			}
			const description = toEnumValueDescription(entry)
			if (description !== undefined) {
				result[stringValues[i]] = description
			}
		})
	} else if (typeof ext === 'object') {
		/* An object keyed by enum value */
		for (const key of Object.keys(ext as Record<string, unknown>)) {
			if (stringValues.indexOf(key) === -1) {
				state.log(CodegenLogLevel.WARN, `x-enum-descriptions references unknown enum value "${key}" in ${debugStringify(apiSchema)}`)
				continue
			}
			const description = toEnumValueDescription((ext as Record<string, unknown>)[key])
			if (description !== undefined) {
				result[key] = description
			}
		}
	} else {
		state.log(CodegenLogLevel.WARN, `x-enum-descriptions is not an array or object in ${debugStringify(apiSchema)}`)
	}

	return result
}

/**
 * Extract a description string from a single `x-enum-descriptions` entry, which may be a plain description string or
 * an object with a `description` property. Returns `undefined` if no description can be determined.
 */
function toEnumValueDescription(entry: unknown): string | undefined {
	if (typeof entry === 'string') {
		return entry
	} else if (entry && typeof entry === 'object' && typeof (entry as { description?: unknown }).description === 'string') {
		return (entry as { description: string }).description
	} else {
		return undefined
	}
}
