import { CodegenAnyOfSchema, CodegenAnyOfStrategy, CodegenLogLevel, CodegenObjectSchema, CodegenProperty, CodegenPropertySummary, CodegenSchema, CodegenSchemaPurpose, CodegenSchemaType, isCodegenCompositionSchema, isCodegenDiscriminatableSchema, isCodegenObjectSchema } from '@openapi-generator-plus/types'
import * as idx from '@openapi-generator-plus/indexed-type'
import { SchemaOptionsRequiredNaming, toCodegenSchemaUsage } from '.'
import { debugStringify } from '@openapi-generator-plus/utils'
import { isOpenAPIv3SchemaObject } from '../../openapi-type-guards'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { toCodegenExamples } from '../examples'
import { toCodegenExternalDocs } from '../external-docs'
import { resolveReference } from '../utils'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { addToDiscriminator, discoverDiscriminatorReferencesInOtherDocuments, loadDiscriminatorMappings, toCodegenSchemaDiscriminator } from './discriminator'
import { createIfNotExistsCodegenInterfaceSchema } from './interface'
import { extractNaming, ScopedModelInfo } from './naming'
import { absorbCodegenSchema } from './object-absorb'
import { toCodegenComposedInterfaceSchema } from './one-of'
import { isObjectLikeSchemaType, toCodegenSchemaTypeFromApiSchema } from './schema-type'
import { addImplementor, addToKnownSchemas, extractCodegenSchemaCommon, finaliseSchema } from './utils'
import { createWrapperSchemaUsage } from './wrapper'

export function toCodegenAnyOfSchema(apiSchema: OpenAPIX.SchemaObject, options: SchemaOptionsRequiredNaming, state: InternalCodegenState): CodegenSchema {
	const strategy = state.generator.anyOfStrategy()
	switch (strategy) {
		case CodegenAnyOfStrategy.NATIVE:
			return toCodegenAnyOfSchemaNative(apiSchema, options, state)
		case CodegenAnyOfStrategy.OBJECT:
			return toCodegenAnyOfSchemaObject(apiSchema, options, state)
	}
	throw new Error(`Unsupported anyOf strategy: ${strategy}`)
}

function toCodegenAnyOfSchemaNative(apiSchema: OpenAPIX.SchemaObject, options: SchemaOptionsRequiredNaming, state: InternalCodegenState): CodegenAnyOfSchema {
	const { naming, purpose } = options
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

function toCodegenAnyOfSchemaObject(apiSchema: OpenAPIX.SchemaObject, options: SchemaOptionsRequiredNaming, state: InternalCodegenState): CodegenSchema {
	const { naming, purpose } = options
	const { scopedName, scope } = naming

	const anyOf = apiSchema.anyOf as Array<OpenAPIX.SchemaObject>

	/* An anyOf models a value that validates against at least one of its members. The object strategy represents that
	   as a single object that absorbs each member's (optional) properties, which only works when the members are
	   object-like. We classify the members up-front so we can handle the cases that don't fit that model.
	 */
	const membersAreObjectLike = anyOf.map(member => isObjectLikeSchemaType(toCodegenSchemaTypeFromApiSchema(resolveReference(member, state))))
	if (membersAreObjectLike.every(objectLike => !objectLike)) {
		/* None of the members are object-like (they are primitives, enums or arrays), so there is nothing to absorb
		   into an object; we model the anyOf as an interface implemented by each member, wrapping the members so
		   each keeps its own type rather than collapsing them to a common type.
		 */
		return toCodegenComposedInterfaceSchema(apiSchema, anyOf, CodegenSchemaPurpose.ANY_OF, options, state)
	} else if (membersAreObjectLike.some(objectLike => !objectLike)) {
		/* A mix of object-like and non-object-like members is not yet supported */
		// TODO
		throw new Error(`anyOf combining object and non-object schemas is not yet supported: ${debugStringify(apiSchema)}`)
	}

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

	const added: [OpenAPIX.SchemaObject, CodegenSchema][] = []

	/* Absorb the members' properties into this object. We defer creating interfaces until we've
	   confirmed the members are mutually compatible, as a single object cannot implement member
	   interfaces that declare the same property with incompatible types (e.g. a property that is
	   nullable in one member but not another, which the target language may represent with
	   different types).
	 */
	const members: [OpenAPIX.SchemaObject, CodegenObjectSchema][] = []
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
		members.push([anyOfApiSchema, anyOfSchema])
	}

	if (anyOfMembersHaveCompatibleProperties(members.map(([, schema]) => schema), state)) {
		/* Use interface conformance so the object can be used wherever a member is expected */
		for (const [anyOfApiSchema, anyOfSchema] of members) {
			/* Make sure there's an interface schema to use */
			const interfaceSchema = createIfNotExistsCodegenInterfaceSchema(anyOfSchema, scope, CodegenSchemaPurpose.INTERFACE, state)

			addImplementor(interfaceSchema, result)
			added.push([anyOfApiSchema, interfaceSchema])
		}
	} else {
		/* The members share properties with incompatible types, so we cannot implement their interfaces.
		   We still absorb all of the members' properties above, so the object remains a valid union of them.
		 */
		state.log(CodegenLogLevel.INFO, `anyOf schema "${(naming.originalScopedName || scopedName).join('.')}" members not suitable for interface conformance: incompatible properties`)
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

/**
 * Check that where the anyOf members share a property (by serialized name), those properties are
 * mutually compatible, so that a single object absorbing all of them can also implement each member's
 * interface. Members legitimately differ on whether a property is required, so we ignore `required`
 * and only consider the property type, format and nullability.
 */
function anyOfMembersHaveCompatibleProperties(members: CodegenObjectSchema[], state: InternalCodegenState): boolean {
	const propertiesByName: Record<string, CodegenProperty[]> = {}
	for (const member of members) {
		collectProperties(member, propertiesByName)
	}

	for (const properties of Object.values(propertiesByName)) {
		const first = properties[0]
		for (let i = 1; i < properties.length; i++) {
			if (!propertiesCompatible(first, properties[i], state)) {
				return false
			}
		}
	}
	return true
}

/**
 * Collect the properties of the given object schema, including those inherited from its parents,
 * grouping them by serialized name.
 */
function collectProperties(schema: CodegenObjectSchema, into: Record<string, CodegenProperty[]>): void {
	if (schema.parents) {
		for (const aParent of schema.parents) {
			collectProperties(aParent, into)
		}
	}
	if (schema.properties) {
		for (const property of idx.allValues(schema.properties)) {
			const existing = into[property.serializedName]
			if (existing) {
				existing.push(property)
			} else {
				into[property.serializedName] = [property]
			}
		}
	}
}

function propertiesCompatible(a: CodegenProperty, b: CodegenProperty, state: InternalCodegenState): boolean {
	const summaryA = toPropertySummary(a)
	const summaryB = toPropertySummary(b)
	return state.generator.checkPropertyCompatibility(summaryA, summaryB) && state.generator.checkPropertyCompatibility(summaryB, summaryA)
}

function toPropertySummary(property: CodegenProperty): CodegenPropertySummary {
	return {
		name: property.name,
		type: property.schema.type || undefined,
		format: property.schema.format || undefined,
		nullable: property.nullable,
		readOnly: property.readOnly,
		writeOnly: property.writeOnly,
		/* We ignore required when checking compatibility of anyOf members, so we normalise it here */
		required: false,
	}
}
