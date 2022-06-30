import { CodegenLogLevel, CodegenProperties, CodegenProperty, CodegenPropertySummary, CodegenSchemaPurpose, CodegenSchemaUsage, CodegenScope } from '@openapi-generator-plus/types'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { convertToBoolean, extractCodegenSchemaUsage, toCodegenInitialValueOptions } from '../utils'
import * as idx from '@openapi-generator-plus/indexed-type'
import { toUniqueName } from './naming'
import { isOpenAPIReferenceObject } from '../../openapi-type-guards'
import { toCodegenSchemaUsage } from '.'
import { OpenAPIV3_1 } from 'openapi-types'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { transformNativeTypeForUsage } from './usage'
import { debugStringify } from '@openapi-generator-plus/utils'

export function toCodegenProperties(apiSchema: OpenAPIX.SchemaObject, scope: CodegenScope, state: InternalCodegenState): CodegenProperties | undefined {
	if (typeof apiSchema.properties !== 'object') {
		return undefined
	}

	const requiredPropertyNames = toRequiredPropertyNames(apiSchema)

	const properties: CodegenProperties = idx.create()
	for (const propertyName in apiSchema.properties) {
		const requiredIndex = requiredPropertyNames.indexOf(propertyName)
		const required = requiredIndex !== -1

		const propertySchema = apiSchema.properties[propertyName]
		const property = toCodegenProperty(propertyName, propertySchema, required, scope, state)
		addCodegenProperty(properties, property, state)

		if (required) {
			requiredPropertyNames.splice(requiredIndex, 1)
		}
	}

	if (requiredPropertyNames.length > 0) {
		state.log(CodegenLogLevel.WARN, `Required properties [${requiredPropertyNames.join(', ')}] missing from properties: ${debugStringify(apiSchema)}`)
	}

	return idx.undefinedIfEmpty(properties)
}

export function toRequiredPropertyNames(apiSchema: OpenAPIX.SchemaObject): string[] {
	return typeof apiSchema.required === 'object' ? [...apiSchema.required as string[]] : []
}

/**
 * Add the given property to the given set of object properties. Ensures that the property name is unique within the set of properties.
 * Note that property names are unique in the spec, but may not be when converted to identifiers for the current generator.
 * @param properties the object properties
 * @param property the property to add
 * @param state 
 * @returns 
 */
export function addCodegenProperty(properties: CodegenProperties, property: CodegenProperty, state: InternalCodegenState): CodegenProperty {
	const uniquePropertyName = toUniqueName(property.name, undefined, properties, state)
	property.name = uniquePropertyName

	if (idx.has(properties, property.serializedName)) {
		throw new Error(`properties already includes "${property.serializedName}" in ${properties}`)
	}
	idx.set(properties, property.serializedName, property)
	return property
}

function toCodegenProperty(name: string, apiSchema: OpenAPIX.SchemaObject, required: boolean, scope: CodegenScope | null, state: InternalCodegenState): CodegenProperty {
	/* We allow preserving the original description if the usage is by reference */
	const description = isOpenAPIReferenceObject(apiSchema) ? (apiSchema as OpenAPIV3_1.ReferenceObject).description : undefined

	const schemaUsage = toCodegenSchemaUsage(apiSchema, state, {
		required, 
		suggestedName: name,
		purpose: CodegenSchemaPurpose.PROPERTY,
		suggestedScope: scope,
	})
	return {
		...schemaUsage,
		name: state.generator.toIdentifier(name),
		serializedName: name,
		description: description || schemaUsage.schema.description || null,
		initialValue: state.generator.initialValue(toCodegenInitialValueOptions(schemaUsage)),
		vendorExtensions: toCodegenVendorExtensions(apiSchema),
		discriminators: null,
	}
}

export function toCodegenPropertySummary(name: string, apiSchema: OpenAPIX.SchemaObject, required: boolean): CodegenPropertySummary {
	return {
		name,
		type: apiSchema.type as string | undefined,
		format: apiSchema.format,
		readOnly: convertToBoolean(apiSchema.readOnly, false),
		writeOnly: convertToBoolean(apiSchema.writeOnly, false),
		nullable: convertToBoolean(apiSchema.nullable, false),
		required,
	}
}

export function createCodegenProperty(name: string, schemaUsage: CodegenSchemaUsage, state: InternalCodegenState): CodegenProperty {
	const property: CodegenProperty = {
		name: state.generator.toIdentifier(name),
		serializedName: name,
		description: null,
		...extractCodegenSchemaUsage(schemaUsage),
		initialValue: state.generator.initialValue(toCodegenInitialValueOptions(schemaUsage)),
		vendorExtensions: null,
		discriminators: null,
	}
	property.nativeType = transformNativeTypeForUsage(property, state)
	return property
}
