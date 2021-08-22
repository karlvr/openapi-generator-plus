import { CodegenArrayTypePurpose, CodegenDiscriminator, CodegenDiscriminatorMappings, CodegenLogLevel, CodegenMapTypePurpose, CodegenNamedSchemas, CodegenObjectSchema, CodegenProperties, CodegenProperty, CodegenSchemaPurpose, CodegenSchemaType, CodegenScope, isCodegenObjectSchema } from '@openapi-generator-plus/types'
import { isOpenAPIReferenceObject, isOpenAPIv3SchemaObject } from '../../openapi-type-guards'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { extractCodegenTypeInfo } from '../utils'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { extractNaming, fullyQualifiedName, ScopedModelInfo, toUniqueName, toUniqueScopedName } from './naming'
import { addToKnownSchemas, extractCodegenSchemaCommon } from './utils'
import * as idx from '@openapi-generator-plus/indexed-type'
import { toCodegenSchemaUsage } from './index'
import { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'
import { nullIfEmpty } from '@openapi-generator-plus/indexed-type'
import { toCodegenExamples } from '../examples'
import { toCodegenArraySchema } from './array'
import { toCodegenMapSchema } from './map'
import { CodegenFullTransformingNativeTypeImpl } from '../../native-type'

export function toCodegenObjectSchema(schema: OpenAPIX.SchemaObject, naming: ScopedModelInfo, $ref: string | undefined, state: InternalCodegenState): CodegenObjectSchema {
	const { name, scopedName, scope } = naming
	
	const vendorExtensions = toCodegenVendorExtensions(schema)

	const nativeType = state.generator.toNativeObjectType({
		type: schema.type as string,
		format: schema.format,
		scopedName,
		vendorExtensions,
	})

	let model: CodegenObjectSchema = {
		...extractNaming(naming),

		...extractCodegenSchemaCommon(schema, state),

		properties: null,
		additionalProperties: null,
		examples: null,
		discriminator: null,
		discriminatorValues: null,
		children: null,
		isInterface: false,
		vendorExtensions,
		nativeType,
		type: 'object',
		format: schema.format || null,
		schemaType: CodegenSchemaType.OBJECT,
		implements: null,
		implementors: null,
		parent: null,
		parentNativeType: null,
		schemas: null,
		component: null,
		deprecated: false,
	}

	model.examples = toCodegenExamples(schema.example, undefined, undefined, model, state)

	if (isOpenAPIv3SchemaObject(schema, state.specVersion)) {
		model.deprecated = schema.deprecated || false
	}

	/* Must add model to knownSchemas here before we try to load other models to avoid infinite loop
	   when a model references other models that in turn reference this model.
	 */
	model = addToKnownSchemas(schema, model, state)

	model.properties = toCodegenProperties(schema, model, state) || null

	function absorbProperties(otherProperties: CodegenProperties, options: { makePropertiesOptional?: boolean }) {
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
	function absorbModels(otherModels: CodegenNamedSchemas) {
		for (const otherModel of idx.allValues(otherModels)) {
			if (!model.schemas) {
				model.schemas = idx.create()
			}
			idx.set(model.schemas, otherModel.name, otherModel)
		}
	}

	function absorbSchema(otherSchema: OpenAPIX.SchemaObject) {
		if (!isOpenAPIReferenceObject(otherSchema)) {
			/*
			If the other schema is inline, and we can just absorb its properties and any sub-schemas it creates,
			then we do. We absorb the sub-schemas it creates by passing this model as to scope to toCodegenProperties.

			This will not work in the inline schema is not an object schema, or is an allOf, oneOf, anyOf etc, in which
			case we fall back to using toCodegenSchemaUsage.
			*/

			const otherProperties = toCodegenProperties(otherSchema, model, state)
			if (otherProperties) {
				absorbProperties(otherProperties, {})
				return undefined
			}
		}

		const otherSchemaUsage = toCodegenSchemaUsage(otherSchema, state, {
			required: true,
			suggestedName: name,
			purpose: CodegenSchemaPurpose.MODEL,
			scope,
		})
		const otherSchemaModel = otherSchemaUsage.schema
		if (!isCodegenObjectSchema(otherSchemaModel)) {
			throw new Error(`Cannot absorb schema as it isn't an object: ${otherSchema}`)
		}

		/* We only include nested models if the model being observed won't actually exist to contain its nested models itself */
		absorbModel(otherSchemaModel, { includeNestedModels: false })
		return otherSchemaModel
	}

	function absorbModel(otherModel: CodegenObjectSchema, options: { includeNestedModels?: boolean; makePropertiesOptional?: boolean }) {
		if (otherModel.parent) {
			absorbModel(otherModel.parent, options)
		}
		if (otherModel.properties) {
			absorbProperties(otherModel.properties, { makePropertiesOptional: options.makePropertiesOptional })
		}
		if (options.includeNestedModels && otherModel.schemas) {
			absorbModels(otherModel.schemas)
		}
	}

	if (schema.allOf) {
		const allOf = schema.allOf as Array<OpenAPIX.SchemaObject>

		/* We support single parent inheritance, so check if that's possible.
		   We go for single parent inheritance if our first schema is a reference, and our second is inline.
		 */
		if (allOf.length <= 2) {
			const possibleParentSchema = allOf[0]
			const nextSchema = allOf[1]

			const canDoSingleParentInheritance = isOpenAPIReferenceObject(possibleParentSchema) && (!nextSchema || !isOpenAPIReferenceObject(nextSchema))
			if (canDoSingleParentInheritance) {
				const parentSchemaUsage = toCodegenSchemaUsage(possibleParentSchema, state, {
					required: true,
					suggestedName: 'parent',
					purpose: CodegenSchemaPurpose.MODEL,
					scope,
				})
				const parentModel = parentSchemaUsage.schema

				/* If the parent model is an interface then we cannot use it as a parent */
				if (isCodegenObjectSchema(parentModel) && !parentModel.isInterface) {
					model.parent = parentModel
					/* We set this models native type to use the parentType from our parent's native type */
					model.parentNativeType = new CodegenFullTransformingNativeTypeImpl(parentModel.nativeType, {
						default: t => t.parentType,
					})

					allOf.shift()
				}
			}
		}

		for (const otherSchema of allOf) {
			const otherModel = absorbSchema(otherSchema)
			if (otherModel && otherModel.discriminator) {
				/* otherModel has a discriminator so we need to add ourselves as a subtype, and now otherModel must be an interface!!!
				   As we're absorbing an already constructed model, it has already found its discriminator property.
				*/
				const discriminatorValue = $ref && otherModel.discriminator.mappings && otherModel.discriminator.mappings[$ref] ? otherModel.discriminator.mappings[$ref] : name
				const discriminatorValueLiteral = state.generator.toLiteral(discriminatorValue, {
					...otherModel.discriminator,
					required: true,
					nullable: false,
					readOnly: false,
					writeOnly: false,
				})
				otherModel.discriminator.references.push({
					model,
					name: discriminatorValue,
					value: discriminatorValueLiteral,
				})
				if (!model.discriminatorValues) {
					model.discriminatorValues = []
				}
				model.discriminatorValues.push({
					model: otherModel,
					value: discriminatorValueLiteral,
				})
			}
		}
	} else if (schema.anyOf) {
		/* We bundle all of the properties together into this model and turn the subModels into interfaces */
		const anyOf = schema.anyOf as Array<OpenAPIX.SchemaObject>
		for (const subSchema of anyOf) {
			const subSchemaUsage = toCodegenSchemaUsage(subSchema, state, {
				required: true,
				suggestedName: 'submodel',
				purpose: CodegenSchemaPurpose.MODEL,
				scope: model,
			})
			const subModel = subSchemaUsage.schema
			if (!isCodegenObjectSchema(subModel)) {
				// TODO
				throw new Error(`Non-model schema not yet supported in anyOf: ${subSchema}`)
			}

			absorbModel(subModel, { includeNestedModels: false, makePropertiesOptional: true })
			subModel.isInterface = true // TODO if a submodel is also required to be concrete, perhaps we should create separate interface and concrete implementations of the same model

			if (!model.implements) {
				model.implements = idx.create()
			}
			idx.set(model.implements, subModel.name, subModel)
			if (!subModel.implementors) {
				subModel.implementors = idx.create()
			}
			idx.set(subModel.implementors, model.name, model)
		}
	} else if (schema.oneOf) {
		const oneOf = schema.oneOf as Array<OpenAPIX.SchemaObject>
		if (schema.discriminator) {
			if (model.properties) {
				throw new Error(`oneOf cannot have properties: ${model.nativeType}`)
			}
			model.isInterface = true

			const schemaDiscriminator = schema.discriminator as OpenAPIV3.DiscriminatorObject
			const mappings = toCodegenDiscriminatorMappings(schemaDiscriminator)
			model.discriminator = {
				name: schemaDiscriminator.propertyName,
				mappings,
				references: [],
				type: 'string',
				format: null,
				component: null,
				schemaType: CodegenSchemaType.STRING,
				nativeType: state.generator.toNativeType({ type: 'string' }),
			}
			
			for (const subSchema of oneOf) {
				const subSchemaUsage = toCodegenSchemaUsage(subSchema, state, {
					required: true, 
					suggestedName: 'submodel',
					purpose: CodegenSchemaPurpose.MODEL,
					scope: model,
				})
				const subModel = subSchemaUsage.schema
				if (!isCodegenObjectSchema(subModel)) {
					throw new Error(`Non-model schema not support in oneOf with discriminator: ${subSchema}`)
				}

				const subModelDiscriminatorProperty = removeModelProperty(subModel.properties || undefined, schemaDiscriminator.propertyName)
				if (!subModelDiscriminatorProperty) {
					throw new Error(`Discriminator property "${schemaDiscriminator.propertyName}" for "${nativeType}" missing from "${subModel.nativeType}"`)
				}

				let discriminatorValue = subModel.name
				if (isOpenAPIReferenceObject(subSchema) && mappings[subSchema.$ref]) {
					discriminatorValue = mappings[subSchema.$ref]
				}

				const discriminatorValueLiteral = state.generator.toLiteral(discriminatorValue, {
					...model.discriminator,
					required: true,
					nullable: false,
					readOnly: false,
					writeOnly: false,
				})
				
				model.discriminator.references.push({
					model: subModel,
					name: discriminatorValue,
					value: discriminatorValueLiteral,
				})

				if (!subModel.discriminatorValues) {
					subModel.discriminatorValues = []
				}
				subModel.discriminatorValues.push({
					model,
					value: discriminatorValueLiteral,
				})

				if (!subModel.implements) {
					subModel.implements = idx.create()
				}
				idx.set(subModel.implements, model.name, model)
				if (!model.implementors) {
					model.implementors = idx.create()
				}
				idx.set(model.implementors, subModel.name, subModel)
			}
		} else {
			/* Without a discriminator we turn this model into an interface and the submodels implement it */
			model.isInterface = true

			for (const subSchema of oneOf) {
				const subSchemaUsage = toCodegenSchemaUsage(subSchema, state, {
					required: true,
					suggestedName: 'submodel',
					purpose: CodegenSchemaPurpose.MODEL,
					scope: model,
				})
				const subModel = subSchemaUsage.schema
				if (isCodegenObjectSchema(subModel)) {
					if (!subModel.implements) {
						subModel.implements = idx.create()
					}
					idx.set(subModel.implements, model.name, model)
					if (!model.implementors) {
						model.implementors = idx.create()
					}
					idx.set(model.implementors, subModel.name, subModel)
				} else {
					// TODO resolve this hack as we can only have models as implementors, and the TypeScript generator politely handles it
					const fakeName = toUniqueScopedName(undefined, subModel.name || 'fake', model, subSchema, state)
					const fakeModel: CodegenObjectSchema = subModel as unknown as CodegenObjectSchema
					if (!fakeModel.implements) {
						fakeModel.implements = idx.create()
					}
					idx.set(fakeModel.implements, model.name, model)
					if (!model.implementors) {
						model.implementors = idx.create()
					}
					idx.set(model.implementors, fakeName.name, subModel)

					state.usedFullyQualifiedSchemaNames[fullyQualifiedName(fakeName.scopedName)] = true
				}
			}
		}
	} else if (schema.enum) {
		throw new Error(`Illegal entry into toCodegenObjectSchema for enum schema: ${schema}`)
	} else if (schema.type === 'array') {
		const result = toCodegenArraySchema(schema, naming, 'item', model, CodegenArrayTypePurpose.PARENT, state)
		model.parentNativeType = result.nativeType
		model.component = result.component
	} else if (schema.type === 'object') {
		if (schema.additionalProperties) {
			/* This schema also has additional properties */
			const mapSchema = toCodegenMapSchema(schema, naming, 'value', model, CodegenMapTypePurpose.PROPERTY, state)
			model.additionalProperties = mapSchema
		}
		
		if (schema.discriminator) {
			/* Object has a discriminator so all submodels will need to add themselves */
			let schemaDiscriminator = schema.discriminator as string | OpenAPIV3.DiscriminatorObject
			if (typeof schemaDiscriminator === 'string') {
				schemaDiscriminator = {
					propertyName: schemaDiscriminator,
					/* Note that we support a vendor extension here to allow mappings in OpenAPI v2 specs */
					mapping: vendorExtensions && vendorExtensions['x-discriminator-mapping'],
				}
			}

			const discriminatorProperty = removeModelProperty(model.properties || undefined, schemaDiscriminator.propertyName)
			if (!discriminatorProperty) {
				throw new Error(`Discriminator property "${schemaDiscriminator.propertyName}" missing from "${nativeType}"`)
			}

			model.discriminator = {
				name: discriminatorProperty.name,
				mappings: toCodegenDiscriminatorMappings(schemaDiscriminator),
				references: [],
				...extractCodegenTypeInfo(discriminatorProperty),
			}

			/* Make sure we load any models referenced by the discriminator, as they may not be
			   in our components/schemas that we load automatically, such as when they're in external
			   documents.
			 */
			if (model.discriminator.mappings) {
				for (const mappingRef of Object.keys(model.discriminator.mappings)) {
					toCodegenSchemaUsage({ $ref: mappingRef }, state, {
						required: false,
						suggestedName: 'discriminatorMapping',
						purpose: CodegenSchemaPurpose.MODEL,
						scope,
					})
				}
			}
		}
	} else {
		/* Other schema types aren't represented as models, they are just inline type definitions like a string with a format,
		   and they shouldn't get into toCodegenObjectSchema. */
		throw new Error(`Invalid schema to convert to model: ${schema.type}`)
	}

	/* Add child model */
	if (model.parent) {
		if (!model.parent.children) {
			model.parent.children = idx.create()
		}
		idx.set(model.parent.children, model.name, model)

		const discriminatorModel = findClosestDiscriminatorModel(model.parent)
		if (discriminatorModel) {
			const discriminator = discriminatorModel.discriminator!
			const discriminatorValue = ($ref && findDiscriminatorMapping(discriminator, $ref)) || model.name
			const discriminatorValueLiteral = state.generator.toLiteral(discriminatorValue, {
				...discriminator,
				required: true,
				nullable: false,
				readOnly: false,
				writeOnly: false,
			})
			if (!model.discriminatorValues) {
				model.discriminatorValues = []
			}
			model.discriminatorValues.push({
				model: discriminatorModel,
				value: discriminatorValueLiteral,
			})
			discriminator.references.push({
				model,
				name: discriminatorValue,
				value: discriminatorValueLiteral,
			})
		}
	}

	/* Check properties */
	model.properties = nullIfEmpty(model.properties)

	return model
}

function toCodegenProperties(schema: OpenAPIX.SchemaObject, scope: CodegenScope, state: InternalCodegenState): CodegenProperties | undefined {
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
	idx.set(properties, property.name, property)
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

function findDiscriminatorMapping(discriminator: CodegenDiscriminator, ref: string): string | undefined {
	if (discriminator.mappings) {
		return discriminator.mappings[ref]
	} else {
		return undefined
	}
}

function findClosestDiscriminatorModel(model: CodegenObjectSchema): CodegenObjectSchema | undefined {
	if (model.discriminator) {
		return model
	} else if (model.parent) {
		return findClosestDiscriminatorModel(model.parent)
	} else {
		return undefined
	}
}

function removeModelProperty(properties: CodegenProperties | undefined, name: string): CodegenProperty | undefined {
	if (!properties) {
		return undefined
	}

	const entry = idx.findEntry(properties, p => p.name === name)
	if (!entry) {
		return undefined
	}

	idx.remove(properties, entry[0])
	return entry[1]
}

function toCodegenDiscriminatorMappings(discriminator: OpenAPIV3.DiscriminatorObject): CodegenDiscriminatorMappings {
	const schemaMappings: CodegenDiscriminatorMappings = {}
	if (discriminator.mapping) {
		for (const mapping in discriminator.mapping) {
			const ref = discriminator.mapping[mapping]
			schemaMappings[ref] = mapping
		}
	}
	return schemaMappings
}
