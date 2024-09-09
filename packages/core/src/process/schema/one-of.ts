import { CodegenInterfaceSchema, CodegenOneOfSchema, CodegenOneOfStrategy, CodegenSchema, CodegenSchemaPurpose, CodegenSchemaType, CodegenScope, isCodegenCompositionSchema, isCodegenDiscriminatableSchema, isCodegenObjectSchema, isCodegenWrapperSchema } from '@openapi-generator-plus/types'
import { toCodegenSchemaUsage } from '.'
import { debugStringify } from '@openapi-generator-plus/utils'
import { isOpenAPIv3SchemaObject } from '../../openapi-type-guards'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { toCodegenExamples } from '../examples'
import { toCodegenExternalDocs } from '../external-docs'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { addToDiscriminator, discoverDiscriminatorReferencesInOtherDocuments, loadDiscriminatorMappings, toCodegenSchemaDiscriminator } from './discriminator'
import { checkContainsRelationship, extractNaming, ScopedModelInfo, toUniqueScopedName } from './naming'
import { addImplementor, addToKnownSchemas, baseSuggestedNameForRelatedSchemas, extractCodegenSchemaCommon, finaliseSchema } from './utils'
import { createWrapperSchemaUsage } from './wrapper'

export function toCodegenOneOfSchema(apiSchema: OpenAPIX.SchemaObject, naming: ScopedModelInfo, purpose: CodegenSchemaPurpose, state: InternalCodegenState): CodegenOneOfSchema | CodegenInterfaceSchema {
	const strategy = state.generator.oneOfStrategy()
	switch (strategy) {
		case CodegenOneOfStrategy.NATIVE:
			return toCodegenOneOfSchemaNative(apiSchema, naming, purpose, state)
		case CodegenOneOfStrategy.INTERFACE:
			return toCodegenOneOfSchemaInterface(apiSchema, naming, purpose, state)
	}
	throw new Error(`Unsupported oneOf strategy: ${strategy}`)
}

function toCodegenOneOfSchemaNative(apiSchema: OpenAPIX.SchemaObject, naming: ScopedModelInfo, purpose: CodegenSchemaPurpose, state: InternalCodegenState): CodegenOneOfSchema {
	const { scopedName, scope } = naming

	const vendorExtensions = toCodegenVendorExtensions(apiSchema)

	const nativeType = state.generator.toNativeObjectType({
		type: 'object',
		purpose,
		schemaType: CodegenSchemaType.ONEOF,
		scopedName,
		vendorExtensions,
	})

	let result: CodegenOneOfSchema = {
		...extractNaming(naming),
		...extractCodegenSchemaCommon(apiSchema, state),

		discriminator: null,
		discriminatorValues: null,
		polymorphic: true,
		vendorExtensions,
		externalDocs: toCodegenExternalDocs(apiSchema),
		nativeType,
		type: 'oneOf',
		format: null,
		purpose,
		schemaType: CodegenSchemaType.ONEOF,
		contentMediaType: null,
		component: null,
		deprecated: false,
		examples: null,
		schemas: null,

		composes: [],
		implements: null,
	}

	result.examples = toCodegenExamples(apiSchema.example, undefined, undefined, result, state)

	if (isOpenAPIv3SchemaObject(apiSchema, state.specVersion)) {
		result.deprecated = apiSchema.deprecated || false
	}

	/* Must add model to knownSchemas here before we try to load other models to avoid infinite loop
	   when a model references other models that in turn reference this model.
	 */
	result = addToKnownSchemas(apiSchema, result, naming.$ref, state)

	const oneOf = apiSchema.oneOf as Array<OpenAPIX.SchemaObject>
	const added: [OpenAPIX.SchemaObject, CodegenSchema][] = []
	for (const oneOfApiSchema of oneOf) {
		const oneOfSchemaUsage = toCodegenSchemaUsage(oneOfApiSchema, state, {
			purpose: CodegenSchemaPurpose.ONE_OF,
			required: false,
			suggestedScope: state.generator.nativeCompositionCanBeScope() ? result : scope,
			suggestedName: (type) => `${type.toLowerCase()}_value`,
		})
		let oneOfSchema = oneOfSchemaUsage.schema

		if (!isCodegenObjectSchema(oneOfSchema) && !isCodegenCompositionSchema(oneOfSchema) && state.generator.nativeComposedSchemaRequiresObjectLikeOrWrapper()) {
			/* Create a wrapper around this primitive type */
			const wrapper = createWrapperSchemaUsage(`${oneOfSchema.schemaType.toLowerCase()}_value_wrapper`, result, oneOfSchemaUsage, oneOfApiSchema, purpose, state)
			oneOfSchema = wrapper.schema
		}

		result.composes.push(oneOfSchema)
		added.push([oneOfApiSchema, oneOfSchema])
	}

	/* Process discriminator after adding composes so they can be used */
	result.discriminator = toCodegenSchemaDiscriminator(apiSchema, result, state)
	if (result.discriminator) {
		for (const [addedApiSchema, addedSchema] of added) {
			if (!isCodegenDiscriminatableSchema(addedSchema)) {
				throw new Error(`oneOf "${result.name}" with discriminator references a non-discriminatable schema: ${debugStringify(addedApiSchema)}`)
			}
			addToDiscriminator(result, addedSchema, state)
		}
	}
	loadDiscriminatorMappings(result, state)
	discoverDiscriminatorReferencesInOtherDocuments(apiSchema, state)
	finaliseSchema(result, naming, state)
	return result
}

function toCodegenOneOfSchemaInterface(apiSchema: OpenAPIX.SchemaObject, naming: ScopedModelInfo, purpose: CodegenSchemaPurpose, state: InternalCodegenState): CodegenInterfaceSchema {
	const { scopedName } = naming

	const vendorExtensions = toCodegenVendorExtensions(apiSchema)

	const nativeType = state.generator.toNativeObjectType({
		type: 'object',
		purpose,
		schemaType: CodegenSchemaType.INTERFACE,
		scopedName,
		vendorExtensions,
	})

	let result: CodegenInterfaceSchema = {
		...extractNaming(naming),
		...extractCodegenSchemaCommon(apiSchema, state),

		discriminator: null,
		discriminatorValues: null,
		polymorphic: true,

		vendorExtensions,
		externalDocs: toCodegenExternalDocs(apiSchema),
		nativeType,
		type: 'object',
		format: null,
		purpose,
		schemaType: CodegenSchemaType.INTERFACE,
		contentMediaType: null,
		component: null,
		deprecated: false,

		parents: null,
		children: null,
		implementation: null,
		implementors: null,

		properties: null,
		additionalProperties: null,
		examples: null,
		schemas: null,
	}

	result.examples = toCodegenExamples(apiSchema.example, undefined, undefined, result, state)

	if (isOpenAPIv3SchemaObject(apiSchema, state.specVersion)) {
		result.deprecated = apiSchema.deprecated || false
	}

	/* Must add model to knownSchemas here before we try to load other models to avoid infinite loop
	   when a model references other models that in turn reference this model.
	 */
	result = addToKnownSchemas(apiSchema, result, naming.$ref, state)

	const oneOf = apiSchema.oneOf as Array<OpenAPIX.SchemaObject>
	const added: [OpenAPIX.SchemaObject, CodegenSchema][] = []
	for (const oneOfApiSchema of oneOf) {
		const oneOfSchemaUsage = toCodegenSchemaUsage(oneOfApiSchema, state, {
			purpose: CodegenSchemaPurpose.ONE_OF,
			required: false,
			suggestedScope: result,
			suggestedName: type => `${type.toLowerCase()}_value`,
		})
		let oneOfSchema = oneOfSchemaUsage.schema

		if (!isCodegenObjectSchema(oneOfSchema) && !isCodegenCompositionSchema(oneOfSchema)) {
			/* Create a wrapper around this primitive type */
			const wrapper = createWrapperSchemaUsage(
				`${baseSuggestedNameForRelatedSchemas(oneOfSchema) || `${oneOfSchemaUsage.schema.schemaType.toLowerCase()}_value`}_wrapper`, 
				result,
				oneOfSchemaUsage,
				oneOfApiSchema,
				purpose,
				state
			)
			oneOfSchema = wrapper.schema
		}

		if (!isCodegenObjectSchema(oneOfSchema) && !isCodegenCompositionSchema(oneOfSchema) && !isCodegenWrapperSchema(oneOfSchema)) {
			throw new Error(`Failed to convert oneOf part to object schema: ${debugStringify(oneOfApiSchema)}`)
		}

		addImplementor(result, oneOfSchema)
		added.push([oneOfApiSchema, oneOfSchema])
	}

	/* Check for a situation where an implementor of this interface is the scope where the interface is destined for or a parent of that */
	const scope = naming.scope
	if (result.implementors && scope) {
		const needToMoveInterfaceToGlobalScope = !!result.implementors.find(schema => checkContainsRelationship(schema, scope))
		
		if (needToMoveInterfaceToGlobalScope) {
			/* We are creating an interface to represent a oneOf, but the scope in which we're creating it is going to implement
			the interface! This is not allowed (at least in Java) so we bump the naming out of the scope in which it is in.
			*/
			if (naming.moveToGlobalScope) {
				naming.moveToGlobalScope()
			} else {
				throw new Error(`Recursion detected in one-of schema but cannot move interface to global scope: ${debugStringify(result)}`)
			}
			Object.assign(result, extractNaming(naming))

			result.nativeType = state.generator.toNativeObjectType({
				type: 'object',
				purpose,
				schemaType: CodegenSchemaType.INTERFACE,
				scopedName: naming.scopedName,
				vendorExtensions,
			})
		}
	}

	/* Discriminator - must come after the oneOf relationships are established */
	result.discriminator = toCodegenSchemaDiscriminator(apiSchema, result, state)
	if (result.discriminator) {
		for (const [addedApiSchema, addedSchema] of added) {
			if (!isCodegenDiscriminatableSchema(addedSchema)) {
				throw new Error(`oneOf "${result.name}" with discriminator references a non-discriminatable schema: ${debugStringify(addedApiSchema)}`)
			}
			addToDiscriminator(result, addedSchema, state)
		}
	}
	loadDiscriminatorMappings(result, state)
	discoverDiscriminatorReferencesInOtherDocuments(apiSchema, state)
	finaliseSchema(result, naming, state)
	return result
}

export function createOneOfSchema(suggestedName: string, scope: CodegenScope | null, purpose: CodegenSchemaPurpose, state: InternalCodegenState): CodegenOneOfSchema {
	suggestedName = state.generator.toSuggestedSchemaName(suggestedName, {
		purpose,
		schemaType: CodegenSchemaType.OBJECT,
		scope,
	})
	
	const naming = toUniqueScopedName(undefined, suggestedName, scope, undefined, CodegenSchemaType.OBJECT, purpose, state)

	const nativeType = state.generator.toNativeObjectType({
		type: 'object',
		purpose,
		schemaType: CodegenSchemaType.ONEOF,
		scopedName: naming.scopedName,
		vendorExtensions: null,
	})
	
	const result: CodegenOneOfSchema = {
		...extractNaming(naming),

		description: null,
		title: null,
		purpose,

		discriminator: null,
		discriminatorValues: null,
		polymorphic: true,
		vendorExtensions: null,
		externalDocs: null,
		nativeType,
		type: 'oneOf',
		format: null,
		schemaType: CodegenSchemaType.ONEOF,
		contentMediaType: null,
		component: null,
		deprecated: false,
		examples: null,
		schemas: null,
		nullable: false,
		readOnly: false,
		writeOnly: false,

		composes: [],
		implements: null,
	}
	return result
}
