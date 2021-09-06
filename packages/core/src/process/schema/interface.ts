import { CodegenInterfaceSchema, CodegenObjectSchema, CodegenSchemaPurpose, CodegenSchemaType, CodegenScope } from '@openapi-generator-plus/types'
import { InternalCodegenState } from '../../types'
import { extractCodegenSchemaInfo } from '../utils'
import { extractNaming, toUniqueScopedName, usedSchemaName } from './naming'
import { addToScope, scopeOf } from './utils'

/**
 * Create or return the interface schema for the given object schema
 * @param schema 
 * @returns 
 */
export function toCodegenInterfaceSchema(schema: CodegenObjectSchema, scope: CodegenScope | null, state: InternalCodegenState): CodegenInterfaceSchema {
	if (schema.interface) {
		return schema.interface
	}

	/* Create interfaces for parents */
	let parents: CodegenInterfaceSchema[] | null = null
	if (schema.parents) {
		parents = []
		for (const parentSchema of schema.parents) {
			parents.push(toCodegenInterfaceSchema(parentSchema, scopeOf(parentSchema, state), state))
		}
	}

	/* Get a name for this interface */
	const suggestedName = state.generator.toSuggestedSchemaName(schema.name, {
		purpose: CodegenSchemaPurpose.MODEL,
		schemaType: CodegenSchemaType.INTERFACE,
	})
	const naming = toUniqueScopedName(undefined, suggestedName, scope, undefined, CodegenSchemaType.INTERFACE, state)
	usedSchemaName(naming.scopedName, state)

	const nativeType = state.generator.toNativeObjectType({
		type: 'object',
		schemaType: CodegenSchemaType.INTERFACE,
		scopedName: naming.scopedName,
		vendorExtensions: schema.vendorExtensions,
	})

	const result: CodegenInterfaceSchema = {
		...extractNaming(naming),
		...extractCodegenSchemaInfo(schema),

		discriminator: schema.discriminator,
		discriminatorValues: schema.discriminatorValues,
		vendorExtensions: schema.vendorExtensions,
		nativeType,
		type: 'object',
		format: null,
		description: schema.description,
		title: schema.title,
		schemaType: CodegenSchemaType.INTERFACE,
		component: null,
		deprecated: schema.deprecated,

		additionalProperties: schema.additionalProperties,
		properties: schema.properties,
		examples: null,
		children: null,
		implementation: schema,
		implementors: null,
		parents,
		schemas: null,
	}
	schema.interface = result

	if (!schema.implements) {
		schema.implements = []
	}
	schema.implements.push(result)

	if (parents) {
		for (const aParent of parents) {
			if (!aParent.children) {
				aParent.children = []
			}
			aParent.children.push(result)
		}
	}

	addToScope(result, scope, state)
	return result
}
