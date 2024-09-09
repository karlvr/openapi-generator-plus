import { CodegenAnyOfSchema, CodegenAnyOfStrategy, CodegenObjectSchema, CodegenSchema, CodegenSchemaPurpose, CodegenSchemaType, isCodegenCompositionSchema, isCodegenDiscriminatableSchema, isCodegenObjectSchema } from '@openapi-generator-plus/types'
import { toCodegenSchemaUsage } from '.'
import { debugStringify } from '@openapi-generator-plus/utils'
import { isOpenAPIv3SchemaObject } from '../../openapi-type-guards'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { toCodegenExamples } from '../examples'
import { toCodegenExternalDocs } from '../external-docs'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { addToDiscriminator, discoverDiscriminatorReferencesInOtherDocuments, loadDiscriminatorMappings, toCodegenSchemaDiscriminator } from './discriminator'
import { createIfNotExistsCodegenInterfaceSchema } from './interface'
import { extractNaming, ScopedModelInfo } from './naming'
import { absorbCodegenSchema } from './object-absorb'
import { addImplementor, addToKnownSchemas, extractCodegenSchemaCommon, finaliseSchema } from './utils'
import { createWrapperSchemaUsage } from './wrapper'

export function toCodegenAnyOfSchema(apiSchema: OpenAPIX.SchemaObject, naming: ScopedModelInfo, purpose: CodegenSchemaPurpose, state: InternalCodegenState): CodegenAnyOfSchema | CodegenObjectSchema {
	const strategy = state.generator.anyOfStrategy()
	switch (strategy) {
		case CodegenAnyOfStrategy.NATIVE:
			return toCodegenAnyOfSchemaNative(apiSchema, naming, purpose, state)
		case CodegenAnyOfStrategy.OBJECT:
			return toCodegenAnyOfSchemaObject(apiSchema, naming, purpose, state)
	}
	throw new Error(`Unsupported anyOf strategy: ${strategy}`)
}

function toCodegenAnyOfSchemaNative(apiSchema: OpenAPIX.SchemaObject, naming: ScopedModelInfo, purpose: CodegenSchemaPurpose, state: InternalCodegenState): CodegenAnyOfSchema {
	const { scopedName, scope } = naming

	const vendorExtensions = toCodegenVendorExtensions(apiSchema)

	const nativeType = state.generator.toNativeObjectType({
		type: apiSchema.type as string,
		purpose,
		schemaType: CodegenSchemaType.ANYOF,
		scopedName,
		vendorExtensions,
	})

	let result: CodegenAnyOfSchema = {
		...extractNaming(naming),

		...extractCodegenSchemaCommon(apiSchema, state),

		discriminator: null,
		discriminatorValues: null,
		polymorphic: true,
		vendorExtensions,
		externalDocs: toCodegenExternalDocs(apiSchema),
		nativeType,
		type: 'anyOf',
		format: null,
		purpose,
		schemaType: CodegenSchemaType.ANYOF,
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

	/* We bundle all of the properties together into this model and turn the subModels into interfaces */
	const anyOf = apiSchema.anyOf as Array<OpenAPIX.SchemaObject>
	const added: [OpenAPIX.SchemaObject, CodegenSchema][] = []
	for (const anyOfApiSchema of anyOf) {
		const anyOfSchemaUsage = toCodegenSchemaUsage(anyOfApiSchema, state, {
			purpose: CodegenSchemaPurpose.ANY_OF,
			required: false,
			suggestedScope: state.generator.nativeCompositionCanBeScope() ? result : scope,
			suggestedName: (type) => `${type.toLowerCase()}_value`,
		})
		let anyOfSchema = anyOfSchemaUsage.schema

		if (!isCodegenObjectSchema(anyOfSchema) && !isCodegenCompositionSchema(anyOfSchema) && state.generator.nativeComposedSchemaRequiresObjectLikeOrWrapper()) {
			/* Create a wrapper around this primitive type */
			const wrapper = createWrapperSchemaUsage(`${anyOfSchema.type}_value_wrapper`, result, anyOfSchemaUsage, anyOfApiSchema, purpose, state).schema
			anyOfSchema = wrapper
		}

		result.composes.push(anyOfSchema)
		added.push([anyOfApiSchema, anyOfSchema])
	}

	/* Process discriminator after adding composes so they can be used */
	result.discriminator = toCodegenSchemaDiscriminator(apiSchema, result, state)
	if (result.discriminator) {
		for (const [addedApiSchema, addedSchema] of added) {
			if (!isCodegenDiscriminatableSchema(addedSchema)) {
				throw new Error(`anyOf "${result.name}" with discriminator references a non-discriminatable schema: ${debugStringify(addedApiSchema)}`)
			}
			addToDiscriminator(result, addedSchema, state)
		}
	}

	loadDiscriminatorMappings(result, state)
	discoverDiscriminatorReferencesInOtherDocuments(apiSchema, state)
	finaliseSchema(result, naming, state)
	return result
}

function toCodegenAnyOfSchemaObject(apiSchema: OpenAPIX.SchemaObject, naming: ScopedModelInfo, purpose: CodegenSchemaPurpose, state: InternalCodegenState): CodegenObjectSchema {
	const { scopedName, scope } = naming

	const vendorExtensions = toCodegenVendorExtensions(apiSchema)

	const nativeType = state.generator.toNativeObjectType({
		type: 'object',
		purpose,
		schemaType: CodegenSchemaType.OBJECT,
		scopedName,
		vendorExtensions,
	})

	let result: CodegenObjectSchema = {
		...extractNaming(naming),
		...extractCodegenSchemaCommon(apiSchema, state),

		abstract: false,
		discriminator: null,
		discriminatorValues: null,
		polymorphic: true,
		vendorExtensions,
		externalDocs: toCodegenExternalDocs(apiSchema),
		nativeType,
		type: 'object',
		format: null,
		purpose,
		schemaType: CodegenSchemaType.OBJECT,
		contentMediaType: null,
		component: null,
		deprecated: false,

		additionalProperties: null,
		properties: null,
		examples: null,
		children: null,
		interface: null,
		implements: null,
		parents: null,
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

	const anyOf = apiSchema.anyOf as Array<OpenAPIX.SchemaObject>
	const added: [OpenAPIX.SchemaObject, CodegenSchema][] = []

	/* Absorb models and use interface conformance */
	for (const anyOfApiSchema of anyOf) {
		/* We must absorb the schema from the others, and then indicate that we conform to them */
		const anyOfSchema = toCodegenSchemaUsage(anyOfApiSchema, state, {
			required: true,
			suggestedName: `${result.name}_submodel`,
			purpose: CodegenSchemaPurpose.ABSORB,
			suggestedScope: result,
		}).schema
		if (!isCodegenObjectSchema(anyOfSchema)) {
			// TODO
			throw new Error(`Non-object schema not yet supported in anyOf: ${debugStringify(anyOfApiSchema)}`)
		}

		absorbCodegenSchema(anyOfSchema, result, { includeNestedSchemas: false, makePropertiesOptional: true })

		/* Make sure there's an interface schema to use */
		const interfaceSchema = createIfNotExistsCodegenInterfaceSchema(anyOfSchema, scope, CodegenSchemaPurpose.INTERFACE, state)

		addImplementor(interfaceSchema, result)
		added.push([anyOfApiSchema, interfaceSchema])
	}

	/* Process discriminator after adding composes so they can be used */
	result.discriminator = toCodegenSchemaDiscriminator(apiSchema, result, state)
	if (result.discriminator) {
		for (const [addedApiSchema, addedSchema] of added) {
			if (!isCodegenDiscriminatableSchema(addedSchema)) {
				throw new Error(`anyOf "${result.name}" with discriminator references a non-discriminatable schema: ${debugStringify(addedApiSchema)}`)
			}
			addToDiscriminator(result, addedSchema, state)
		}
	}
	
	loadDiscriminatorMappings(result, state)
	discoverDiscriminatorReferencesInOtherDocuments(apiSchema, state)
	finaliseSchema(result, naming, state)
	return result
}
