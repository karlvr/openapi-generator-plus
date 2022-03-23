import { CodegenAllOfStrategy, CodegenHierarchySchema, CodegenInterfaceSchema, CodegenObjectSchema, CodegenSchemaPurpose, CodegenSchemaType, CodegenScope } from '@openapi-generator-plus/types'
import { isOpenAPIv3SchemaObject } from '../../openapi-type-guards'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { extractNaming, ScopedModelInfo, toUniqueScopedName, usedSchemaName } from './naming'
import { addToKnownSchemas, addToScope, extractCodegenSchemaCommon } from './utils'
import { toCodegenExamples } from '../examples'
import { toCodegenMapSchema } from './map'
import { discoverDiscriminatorReferencesInOtherDocuments, loadDiscriminatorMappings, toCodegenSchemaDiscriminator } from './discriminator'
import { toCodegenProperties } from './property'
import { toCodegenExternalDocs } from '../external-docs'
import { toCodegenInterfaceImplementationSchema } from './interface'
import { toCodegenHierarchySchema } from './hierarchy'

export function toCodegenObjectSchema(apiSchema: OpenAPIX.SchemaObject, naming: ScopedModelInfo, state: InternalCodegenState): CodegenObjectSchema | CodegenInterfaceSchema | CodegenHierarchySchema {
	if (apiSchema.discriminator && state.generator.allOfStrategy() === CodegenAllOfStrategy.HIERARCHY) {
		return toCodegenHierarchySchema(apiSchema, naming, state)
	} else if (apiSchema.discriminator && state.generator.allOfStrategy() === CodegenAllOfStrategy.OBJECT && !(state.generator.supportsInheritance() && state.generator.supportsMultipleInheritance())) {
		/* 
		If we use the OBJECT allOf strategy, then we need to consider whether we need to turn objects into interfaces if
		they contain a discriminator.

		If we support multiple inheritance, then we don't need an interface as we can have the object containing the discriminator
		as a parent of any members, thus establishing compatibility.

		If we don't support multiple inheritance (or any form of inheritance) then the schema containing the discriminator needs to
		be an interface so any members can be compatible with it.
		*/
		return toCodegenObjectSchemaInterface(apiSchema, naming, state)
	} else {
		return toCodegenObjectSchemaObject(apiSchema, naming, state)
	}
}

function toCodegenObjectSchemaObject(apiSchema: OpenAPIX.SchemaObject, naming: ScopedModelInfo, state: InternalCodegenState): CodegenObjectSchema {
	const { scopedName } = naming
	
	const vendorExtensions = toCodegenVendorExtensions(apiSchema)

	const nativeType = state.generator.toNativeObjectType({
		type: apiSchema.type as string,
		format: apiSchema.format,
		schemaType: CodegenSchemaType.OBJECT,
		scopedName,
		vendorExtensions,
	})

	let result: CodegenObjectSchema = {
		...extractNaming(naming),

		...extractCodegenSchemaCommon(apiSchema, state),

		abstract: false,
		properties: null,
		additionalProperties: null,
		examples: null,
		discriminator: null,
		discriminatorValues: null,
		polymorphic: false,
		children: null,
		vendorExtensions,
		externalDocs: toCodegenExternalDocs(apiSchema),
		nativeType,
		type: 'object',
		format: apiSchema.format || null,
		schemaType: CodegenSchemaType.OBJECT,
		interface: null,
		implements: null,
		parents: null,
		schemas: null,
		component: null,
		deprecated: false,
	}

	result = handleObjectCommon(apiSchema, naming, result, state)
	// TODO we previous had an issue where a member of a discriminator didn't discover the discriminator
	// because of order-of-operations between populating model.discriminator and the member being created
	// and looking for it. If that happens again, this is one approach to work around it.
	// if (result.discriminator && result.children) {
	// 	for (const aSchema of result.children) {
	// 		if (isCodegenDiscriminatableSchema(aSchema)) {
	// 			addToDiscriminator(result, aSchema, state)
	// 		}
	// 	}
	// }
	return result
}

function toCodegenObjectSchemaInterface(apiSchema: OpenAPIX.SchemaObject, naming: ScopedModelInfo, state: InternalCodegenState): CodegenInterfaceSchema {
	const { scopedName } = naming
	
	const vendorExtensions = toCodegenVendorExtensions(apiSchema)

	const nativeType = state.generator.toNativeObjectType({
		type: apiSchema.type as string,
		format: apiSchema.format,
		schemaType: CodegenSchemaType.INTERFACE,
		scopedName,
		vendorExtensions,
	})

	let result: CodegenInterfaceSchema = {
		...extractNaming(naming),

		...extractCodegenSchemaCommon(apiSchema, state),

		properties: null,
		additionalProperties: null,
		examples: null,
		discriminator: null,
		polymorphic: false,
		discriminatorValues: null,
		children: null,
		vendorExtensions,
		externalDocs: toCodegenExternalDocs(apiSchema),
		nativeType,
		type: 'object',
		format: apiSchema.format || null,
		schemaType: CodegenSchemaType.INTERFACE,
		implementation: null,
		implementors: null,
		parents: null,
		schemas: null,
		component: null,
		deprecated: false,
	}

	result = handleObjectCommon(apiSchema, naming, result, state)
	// TODO we previous had an issue where a member of a discriminator didn't discover the discriminator
	// because of order-of-operations between populating model.discriminator and the member being created
	// and looking for it. If that happens again, this is one approach to work around it.
	// if (result.discriminator && result.implementors) {
	// 	for (const aSchema of result.implementors) {
	// 		if (isCodegenDiscriminatableSchema(aSchema)) {
	// 			addToDiscriminator(result, aSchema, state)
	// 		}
	// 	}
	// }

	if (!result.discriminator) {
		/* As this schema was in the original specification, we should make a concrete implementation of it
		   in case some code expects to use it.
		 */
		toCodegenInterfaceImplementationSchema(result, { allowAbstract: false }, state)
	}

	return result
}

function handleObjectCommon<T extends CodegenObjectSchema | CodegenInterfaceSchema>(apiSchema: OpenAPIX.SchemaObject, naming: ScopedModelInfo, schema: T, state: InternalCodegenState) {
	schema.examples = toCodegenExamples(apiSchema.example, undefined, undefined, schema, state)

	if (isOpenAPIv3SchemaObject(apiSchema, state.specVersion)) {
		schema.deprecated = apiSchema.deprecated || false
	}

	/* Must add model to knownSchemas here before we try to load other models to avoid infinite loop
	   when a model references other models that in turn reference this model.
	 */
	schema = addToKnownSchemas(apiSchema, schema, naming, state)

	schema.properties = toCodegenProperties(apiSchema, schema, state) || null

	if (apiSchema.additionalProperties) {
		/* This schema also has additional properties */
		const mapSchema = toCodegenMapSchema(apiSchema, naming, 'value', schema, state)
		schema.additionalProperties = mapSchema
	}
		
	schema.discriminator = toCodegenSchemaDiscriminator(apiSchema, schema, state)
	if (schema.discriminator) {
		schema.polymorphic = true
	}
	loadDiscriminatorMappings(schema, state)
	discoverDiscriminatorReferencesInOtherDocuments(apiSchema, state)
	return schema
}

/**
 * Create a new schema of an object type with the given name, in the given scope, and add it to that scope.
 * @param suggestedName the suggested name to use, but a unique name will be chosen in that scope
 * @param scope the scope in which to create the object, or `null` to create in the global scope 
 * @param state 
 * @returns 
 */
export function createObjectSchema(suggestedName: string, scope: CodegenScope | null, purpose: CodegenSchemaPurpose, state: InternalCodegenState): CodegenObjectSchema {
	suggestedName = state.generator.toSuggestedSchemaName(suggestedName, {
		purpose,
		schemaType: CodegenSchemaType.OBJECT,
	})
	
	const naming = toUniqueScopedName(undefined, suggestedName, scope, undefined, CodegenSchemaType.OBJECT, state)

	const nativeType = state.generator.toNativeObjectType({
		type: 'object',
		schemaType: CodegenSchemaType.OBJECT,
		scopedName: naming.scopedName,
		vendorExtensions: null,
	})

	const schema: CodegenObjectSchema = {
		...extractNaming(naming),
		type: 'object',
		format: null,
		schemaType: CodegenSchemaType.OBJECT,
		abstract: false,
		properties: null,
		additionalProperties: null,
		examples: null,
		discriminator: null,
		discriminatorValues: null,
		polymorphic: false,
		children: null,
		interface: null,
		implements: null,
		parents: null,
		description: null,
		title: null,
		vendorExtensions: null,
		externalDocs: null,
		nullable: false,
		readOnly: false,
		writeOnly: false,
		deprecated: false,
		nativeType,
		component: null,
		schemas: null,
	}

	addToScope(schema, scope, state)
	usedSchemaName(naming.scopedName, state)
	return schema
}
