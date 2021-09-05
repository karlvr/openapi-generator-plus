import { CodegenLogLevel, CodegenProperties, CodegenProperty, CodegenSchemaPurpose, CodegenSchemaUsage, CodegenScope } from '@openapi-generator-plus/types'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { extractCodegenSchemaUsage } from '../utils'
import * as idx from '@openapi-generator-plus/indexed-type'
import { toUniqueName } from './naming'
import { isOpenAPIReferenceObject } from '../../openapi-type-guards'
import { toCodegenSchemaUsage } from '.'
import { OpenAPIV3_1 } from 'openapi-types'

export function toCodegenProperties(schema: OpenAPIX.SchemaObject, scope: CodegenScope, state: InternalCodegenState): CodegenProperties | undefined {
	if (typeof schema.properties !== 'object') {
		return undefined
	}

	const requiredPropertyNames = typeof schema.required === 'object' ? [...schema.required as string[]] : []

	const properties: CodegenProperties = idx.create()
	for (const propertyName in schema.properties) {
		const requiredIndex = requiredPropertyNames.indexOf(propertyName)
		const required = requiredIndex !== -1

		const propertySchema = schema.properties[propertyName]
		const property = toCodegenProperty(propertyName, propertySchema, required, scope, state)
		addCodegenProperty(properties, property, state)

		if (required) {
			requiredPropertyNames.splice(requiredIndex, 1)
		}
	}

	if (requiredPropertyNames.length > 0) {
		state.log(CodegenLogLevel.WARN, `Required properties [${requiredPropertyNames.join(', ')}] missing from properties: ${JSON.stringify(schema)}`)
	}

	return idx.undefinedIfEmpty(properties)
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

function toCodegenProperty(name: string, schema: OpenAPIX.SchemaObject, required: boolean, scope: CodegenScope | null, state: InternalCodegenState): CodegenProperty {
	/* We allow preserving the original description if the usage is by reference */
	const description = isOpenAPIReferenceObject(schema) ? (schema as OpenAPIV3_1.ReferenceObject).description : undefined

	const schemaUsage = toCodegenSchemaUsage(schema, state, {
		required, 
		suggestedName: name,
		purpose: CodegenSchemaPurpose.PROPERTY,
		scope,
	})
	return {
		...schemaUsage,
		name: state.generator.toIdentifier(name),
		serializedName: name,
		description: description || schemaUsage.schema.description || null,
		initialValue: schemaUsage.defaultValue || state.generator.initialValue(schemaUsage) || null,
	}
}

export function createProperty(name: string, schemaUsage: CodegenSchemaUsage, state: InternalCodegenState): CodegenProperty {
	const property: CodegenProperty = {
		name: state.generator.toIdentifier(name),
		serializedName: name,
		description: null,
		...extractCodegenSchemaUsage(schemaUsage),
		initialValue: null,
	}
	return property
}
