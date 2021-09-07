import { CodegenNamedSchemas, CodegenObjectLikeSchemas, CodegenObjectSchema, CodegenProperties, CodegenSchemaPurpose, CodegenScope, isCodegenObjectLikeSchema } from '@openapi-generator-plus/types'
import * as idx from '@openapi-generator-plus/indexed-type'
import { OpenAPIX } from '../../types/patches'
import { InternalCodegenState } from '../../types'
import { isOpenAPIReferenceObject } from '../../openapi-type-guards'
import { toCodegenProperties } from './property'
import { toCodegenSchemaUsage } from '.'

function absorbProperties(otherProperties: CodegenProperties, model: CodegenObjectSchema, options: { makePropertiesOptional?: boolean }) {
	for (const property of idx.allValues(otherProperties)) {
		const newProperty = { ...property }
		if (options.makePropertiesOptional) {
			newProperty.required = false
		}
		if (!model.properties) {
			model.properties = idx.create()
		}
		idx.set(model.properties, newProperty.name, newProperty)
	}
}

function absorbModels(otherModels: CodegenNamedSchemas, target: CodegenObjectSchema) {
	for (const otherModel of idx.allValues(otherModels)) {
		if (!target.schemas) {
			target.schemas = idx.create()
		}
		idx.set(target.schemas, otherModel.name, otherModel)
	}
}

export function absorbModel(otherModel: CodegenObjectLikeSchemas, target: CodegenObjectSchema, options: { includeNestedModels?: boolean; makePropertiesOptional?: boolean } = {}): void {
	if (otherModel.parents) {
		for (const aParent of otherModel.parents) {
			absorbModel(aParent, target, options)
		}
	}
	if (otherModel.properties) {
		absorbProperties(otherModel.properties, target, { makePropertiesOptional: options.makePropertiesOptional })
	}
	if (options.includeNestedModels && otherModel.schemas) {
		absorbModels(otherModel.schemas, target)
	}
}

export function absorbSchema(otherSchema: OpenAPIX.SchemaObject, target: CodegenObjectSchema, scope: CodegenScope | null, state: InternalCodegenState): CodegenObjectLikeSchemas | undefined {
	if (!isOpenAPIReferenceObject(otherSchema)) {
		/*
			If the other schema is inline, and we can just absorb its properties and any sub-schemas it creates,
			then we do. We absorb the sub-schemas it creates by passing this model as to scope to toCodegenProperties.

			This will not work in the inline schema is not an object schema, or is an allOf, oneOf, anyOf etc, in which
			case we fall back to using toCodegenSchemaUsage.
			*/

		const otherProperties = toCodegenProperties(otherSchema, target, state)
		if (otherProperties) {
			absorbProperties(otherProperties, target, {})
			return undefined
		}
	}

	const otherSchemaUsage = toCodegenSchemaUsage(otherSchema, state, {
		required: true,
		suggestedName: target.name,
		purpose: CodegenSchemaPurpose.MODEL,
		scope,
	})
	const otherSchemaModel = otherSchemaUsage.schema
	if (!isCodegenObjectLikeSchema(otherSchemaModel)) {
		throw new Error(`Cannot absorb schema as it isn't an object: ${JSON.stringify(otherSchema)}`)
	}

	/* We only include nested models if the model being observed won't actually exist to contain its nested models itself */
	absorbModel(otherSchemaModel, target, { includeNestedModels: false })
	return otherSchemaModel
}
