import { CodegenInterfaceSchema, CodegenObjectSchema, CodegenSchemaPurpose, CodegenSchemaType, CodegenScope } from '@openapi-generator-plus/types'
import { InternalCodegenState } from '../../types'
import { extractCodegenSchemaInfo } from '../utils'
import { extractNaming, fullyQualifiedName, toUniqueScopedName, usedSchemaName } from './naming'
import { createObjectSchemaUsage } from './object'
import { absorbCodegenSchema } from './object-absorb'
import { addChildInterfaceSchema, addChildObjectSchema, addImplementor, addToScope, scopeOf } from './utils'

/**
 * Create or return an interface schema for the given object schema
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
		purpose: CodegenSchemaPurpose.EXTRACTED_INTERFACE,
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
		polymorphic: false, /* We are just an interface created for an implementation class, we are not the root of the polymorphic hierarchy */
		vendorExtensions: schema.vendorExtensions,
		externalDocs: schema.externalDocs,
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
		parents: null,
		schemas: null,
	}
	schema.interface = result

	addImplementor(result, schema)

	if (parents) {
		for (const aParent of parents) {
			addChildInterfaceSchema(aParent, result)
		}
	}

	addToScope(result, scope, state)
	return result
}

/**
 * Create or return the implementation schema for the given interface schema.
 * @param schema 
 * @returns a CodegenObjectSchema, or undefined if an implementation cannot be created
 */
export function toCodegenInterfaceImplementationSchema(interfaceSchema: CodegenInterfaceSchema, state: InternalCodegenState): CodegenObjectSchema | undefined {
	if (interfaceSchema.implementation) {
		return interfaceSchema.implementation
	}

	if (!state.generator.supportsInheritance()) {
		return undefined
	}

	const scope = scopeOf(interfaceSchema, state)
	const result = createObjectSchemaUsage(interfaceSchema.name, scope, CodegenSchemaPurpose.IMPLEMENTATION, state).schema

	result.abstract = true
	result.properties = interfaceSchema.properties
	result.additionalProperties = interfaceSchema.additionalProperties

	addImplementor(interfaceSchema, result)

	interfaceSchema.implementation = result
	result.interface = interfaceSchema

	/* Create and extend implementations from interface parents */
	if (interfaceSchema.parents) {
		if (interfaceSchema.parents.length === 1 || state.generator.supportsMultipleInheritance()) {
			for (const aParent of interfaceSchema.parents) {
				const aParentImplementation = toCodegenInterfaceImplementationSchema(aParent, state)
				if (aParentImplementation) {
					addChildObjectSchema(aParentImplementation, result)
				} else {
					throw new Error(`Cannot create implementation for "${fullyQualifiedName(aParent.scopedName)}`)
				}
			}
		} else {
			for (const aParent of interfaceSchema.parents) {
				absorbCodegenSchema(aParent, result, {})
			}
		}
	}

	return result
}
