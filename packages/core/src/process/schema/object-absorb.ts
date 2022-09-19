import { CodegenNamedSchemas, CodegenObjectLikeSchemas, CodegenObjectSchema, CodegenProperties, CodegenSchema, CodegenSchemaPurpose, CodegenScope, isCodegenMapSchema, isCodegenObjectLikeSchema } from '@openapi-generator-plus/types'
import * as idx from '@openapi-generator-plus/indexed-type'
import { OpenAPIX } from '../../types/patches'
import { InternalCodegenState } from '../../types'
import { isOpenAPIReferenceObject } from '../../openapi-type-guards'
import { toCodegenProperties } from './property'
import { toCodegenSchemaUsage } from '.'
import { debugStringify } from '@openapi-generator-plus/utils'
import { toCodegenMapSchema } from './map'
import { baseSuggestedNameForRelatedSchemas } from './utils'

function absorbProperties(otherProperties: CodegenProperties, schema: CodegenObjectSchema, options: { makePropertiesOptional?: boolean }) {
	for (const property of idx.allValues(otherProperties)) {
		const newProperty = { ...property }
		if (options.makePropertiesOptional) {
			newProperty.required = false
		}
		if (!schema.properties) {
			schema.properties = idx.create()
		}
		idx.set(schema.properties, newProperty.serializedName, newProperty)
	}
}

function absorbCodegenSchemas(schemas: CodegenNamedSchemas, target: CodegenObjectSchema) {
	for (const schema of idx.allValues(schemas)) {
		if (!target.schemas) {
			target.schemas = idx.create()
		}
		idx.set(target.schemas, schema.name, schema)
	}
}

export function absorbCodegenSchema(schema: CodegenObjectLikeSchemas, target: CodegenObjectSchema, options: { includeNestedSchemas?: boolean; makePropertiesOptional?: boolean } = {}): void {
	if (schema.parents) {
		for (const aParent of schema.parents) {
			absorbCodegenSchema(aParent, target, options)
		}
	}
	if (schema.properties) {
		absorbProperties(schema.properties, target, { makePropertiesOptional: options.makePropertiesOptional })
	}
	if (schema.additionalProperties) {
		if (target.additionalProperties) {
			throw new Error(`Cannot absorb schema as the target already has additionalProperties: ${debugStringify(schema)}`)
		}
		target.additionalProperties = schema.additionalProperties
	}
	if (options.includeNestedSchemas && schema.schemas) {
		absorbCodegenSchemas(schema.schemas, target)
	}
}

export function absorbApiSchema(apiSchema: OpenAPIX.SchemaObject, target: CodegenObjectSchema, scope: CodegenScope | null, state: InternalCodegenState): CodegenSchema | undefined {
	if (!isOpenAPIReferenceObject(apiSchema)) {
		/*
			If the other schema is inline, and we can just absorb its properties and any sub-schemas it creates,
			then we do. We absorb the sub-schemas it creates by passing this model as to scope to toCodegenProperties.

			This will not work in the inline schema is not an object schema, or is an allOf, oneOf, anyOf etc, in which
			case we fall back to using toCodegenSchemaUsage.
			*/

		let absorbed = false
		const otherProperties = toCodegenProperties(apiSchema, target, state)
		if (otherProperties) {
			absorbProperties(otherProperties, target, {})
			absorbed = true
		}
		if (apiSchema.additionalProperties) {
			if (target.additionalProperties) {
				throw new Error(`Cannot absorb schema as the target already has additionalProperties: ${debugStringify(apiSchema)}`)
			}

			const mapSchema = toCodegenMapSchema(apiSchema, null, 'value', target, state)
			target.additionalProperties = mapSchema
			absorbed = true
		}

		if (absorbed) {
			/* We return undefined as we left nothing that needs to be handled */
			return undefined
		}
	}

	const schemaUsage = toCodegenSchemaUsage(apiSchema, state, {
		required: true,
		suggestedName: baseSuggestedNameForRelatedSchemas(target),
		purpose: CodegenSchemaPurpose.GENERAL,
		suggestedScope: scope,
	})
	const schema = schemaUsage.schema
	if (isCodegenMapSchema(schema)) {
		if (target.additionalProperties) {
			throw new Error(`Cannot absorb schema as the target already has additionalProperties: ${debugStringify(schema)}`)
		}
		target.additionalProperties = schema
	} else if (isCodegenObjectLikeSchema(schema)) {
		/* We only include nested schemas if the schema being observed won't actually exist to contain its nested schemas itself */
		absorbCodegenSchema(schema, target, { includeNestedSchemas: false })
	} else {
		throw new Error(`Cannot absorb schema as it isn't an object: ${debugStringify(schema)}`)
	}
	
	return schema
}
