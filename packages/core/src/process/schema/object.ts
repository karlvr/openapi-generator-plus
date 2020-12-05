import { CodegenArrayTypePurpose, CodegenDiscriminator, CodegenDiscriminatorMappings, CodegenMapTypePurpose, CodegenObjectSchema, CodegenObjectSchemas, CodegenProperties, CodegenProperty, CodegenSchemaPurpose, CodegenSchemaType, CodegenScope } from '@openapi-generator-plus/types'
import { isOpenAPIReferenceObject, isOpenAPIv3SchemaObject } from '../../openapi-type-guards'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { extractCodegenTypeInfo, nameFromRef } from '../utils'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { fullyQualifiedName, toScopedName, toUniqueScopedName } from './naming'
import { addToScope, extractCodegenSchemaCommon, isCodegenObjectSchema } from './utils'
import * as idx from '@openapi-generator-plus/indexed-type'
import { toCodegenSchemaUsage } from './index'
import { OpenAPIV3 } from 'openapi-types'
import { toCodegenArraySchema } from './array'
import { toCodegenMapSchema } from './map'
import { nullIfEmpty } from '@openapi-generator-plus/indexed-type'
import { toCodegenExamples } from '../examples'

export function toCodegenObjectSchema(schema: OpenAPIX.SchemaObject, $ref: string | undefined, suggestedName: string, partial: boolean, suggestedScope: CodegenScope | null, state: InternalCodegenState): CodegenObjectSchema {
	const { scopedName, scope } = partial ? toScopedName($ref, suggestedName, suggestedScope, schema, state) : toUniqueScopedName($ref, suggestedName, suggestedScope, schema, state)
	const name = scopedName[scopedName.length - 1]
	
	/* Check if we've already generated this model, and return it */
	const existing = state.modelsBySchema.get(schema)
	if (existing) {
		return existing
	}

	const vendorExtensions = toCodegenVendorExtensions(schema)

	const nativeType = state.generator.toNativeObjectType({
		modelNames: scopedName,
		vendorExtensions,
	})

	const model: CodegenObjectSchema = {
		name,
		serializedName: $ref ? (nameFromRef($ref) || null) : null,
		scopedName,

		...extractCodegenSchemaCommon(schema, state),

		properties: null,
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
		componentSchema: null,
		deprecated: false,
	}

	model.examples = toCodegenExamples(schema.example, undefined, undefined, model, state)

	if (isOpenAPIv3SchemaObject(schema, state.specVersion)) {
		model.deprecated = schema.deprecated || false
	}

	/* Add to known models */
	if (!partial) {
		state.usedModelFullyQualifiedNames[fullyQualifiedName(scopedName)] = true
		state.modelsBySchema.set(schema, model)
	}

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
	function absorbModels(otherModels: CodegenObjectSchemas) {
		for (const otherModel of idx.allValues(otherModels)) {
			if (!model.schemas) {
				model.schemas = idx.create()
			}
			idx.set(model.schemas, otherModel.name, otherModel)
		}
	}

	function absorbSchema(otherSchema: OpenAPIX.SchemaObject) {
		/* If the other schema is inline, then we create it as a PARTIAL MODEL, so it doesn't get recorded anywhere
		   (we don't want it to actually exist). We also give it exactly the same name and scope as this model
		   (which is only possible for partial models, as we don't unique their names), so that any submodels that
		   it creates end up scoped to this model.
		 */
		if (isOpenAPIReferenceObject(otherSchema)) {
			const otherSchemaUsage = toCodegenSchemaUsage(otherSchema, true, name, CodegenSchemaPurpose.MODEL, scope, state)
			const otherSchemaModel = otherSchemaUsage.schema
			if (!isCodegenObjectSchema(otherSchemaModel)) {
				throw new Error(`Cannot absorb schema as it isn't an object: ${otherSchema}`)
			}

			/* We only include nested models if the model being observed won't actually exist to contain its nested models itself */
			absorbModel(otherSchemaModel, { includeNestedModels: false })
			return otherSchemaModel
		} else {
			const otherSchemaUsage = toCodegenSchemaUsage(otherSchema, true, name, CodegenSchemaPurpose.PARTIAL_MODEL, scope, state)
			/* We only include nested models if the model being observed won't actually exist to contain its nested models itself */
			if (isCodegenObjectSchema(otherSchemaUsage.schema)) {
				absorbModel(otherSchemaUsage.schema, { includeNestedModels: true })
				return otherSchemaUsage.schema
			} else {
				throw new Error(`Cannot absorb a non-object schema in ${model.name}`)
			}
		}		
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
				const parentSchemaUsage = toCodegenSchemaUsage(possibleParentSchema, true, 'parent', CodegenSchemaPurpose.MODEL, suggestedScope, state)
				const parentModel = parentSchemaUsage.schema

				/* If the parent model is an interface then we cannot use it as a parent */
				if (isCodegenObjectSchema(parentModel) && !parentModel.isInterface) {
					model.parent = parentModel
					model.parentNativeType = parentModel.nativeType

					allOf.shift()
				}
			}
		}

		for (const otherSchema of allOf) {
			const otherModel = absorbSchema(otherSchema)
			if (otherModel.discriminator) {
				/* otherModel has a discriminator so we need to add ourselves as a subtype, and now otherModel must be an interface!!!
				   As we're absorbing an already constructed model, it has already found its discriminator property.
				*/
				const discriminatorValue = $ref && otherModel.discriminator.mappings && otherModel.discriminator.mappings[$ref] ? otherModel.discriminator.mappings[$ref] : name
				otherModel.discriminator.references.push({
					model,
					name: discriminatorValue,
				})
				if (!model.discriminatorValues) {
					model.discriminatorValues = []
				}
				model.discriminatorValues.push({
					model: otherModel,
					value: state.generator.toLiteral(discriminatorValue, {
						...otherModel.discriminator, 
						required: true,
					}),
				})
			}
		}
	} else if (schema.anyOf) {
		/* We bundle all of the properties together into this model and turn the subModels into interfaces */
		const anyOf = schema.anyOf as Array<OpenAPIX.SchemaObject>
		for (const subSchema of anyOf) {
			const subSchemaUsage = toCodegenSchemaUsage(subSchema, true, 'submodel', CodegenSchemaPurpose.MODEL, model, state)
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
				componentSchema: null,
				schemaType: CodegenSchemaType.STRING,
				nativeType: state.generator.toNativeType({ type: 'string', required: true }),
			}
			
			for (const subSchema of oneOf) {
				const subSchemaUsage = toCodegenSchemaUsage(subSchema, true, 'submodel', CodegenSchemaPurpose.MODEL, model, state)
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
				
				model.discriminator.references.push({
					model: subModel,
					name: discriminatorValue,
				})

				if (!subModel.discriminatorValues) {
					subModel.discriminatorValues = []
				}
				subModel.discriminatorValues.push({
					model,
					value: state.generator.toLiteral(discriminatorValue, {
						...model.discriminator, 
						required: true,
					}),
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
				const subSchemaUsage = toCodegenSchemaUsage(subSchema, true, 'submodel', CodegenSchemaPurpose.MODEL, model, state)
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
					const fakeName = toUniqueScopedName(undefined, 'fake', model, subSchema, state)
					const fakeModel: CodegenObjectSchema = {
						...subModel,
						type: 'object',
						schemaType: CodegenSchemaType.OBJECT,
						nativeType: subSchemaUsage.nativeType,
						name: fakeName.scopedName[fakeName.scopedName.length - 1],
						serializedName: null,
						properties: null,
						examples: null,
						discriminator: null,
						discriminatorValues: null,
						children: null,
						isInterface: false,
						scopedName: fakeName.scopedName,
						implements: null,
						implementors: null,
						parent: null,
						parentNativeType: null,
						schemas: null,
					}
					fakeModel.implements = idx.create()
					idx.set(fakeModel.implements, model.name, model)
					if (!model.implementors) {
						model.implementors = idx.create()
					}
					idx.set(model.implementors, fakeModel.name, fakeModel)

					state.usedModelFullyQualifiedNames[fullyQualifiedName(fakeName.scopedName)] = true
				}
			}
		}
	} else if (schema.enum) {
		throw new Error(`Illegal entry into toCodegenObjectSchema for enum schema: ${schema}`)
	} else if (schema.type === 'array') {
		if (!state.generator.generateCollectionModels || !state.generator.generateCollectionModels()) {
			throw new Error(`Illegal entry into toCodegenObjectSchema for array schema when we do not generate collection models: ${schema}`)
		}

		const result = toCodegenArraySchema(schema, $ref, 'array', model, CodegenArrayTypePurpose.PARENT, state)
		model.parentNativeType = result.nativeType
		model.componentSchema = result.componentSchema
	} else if (schema.type === 'object') {
		if (schema.additionalProperties) {
			if (!state.generator.generateCollectionModels || !state.generator.generateCollectionModels()) {
				throw new Error(`Illegal entry into toCodegenObjectSchema for map schema when we do not generate collection models: ${schema}`)
			}

			const result = toCodegenMapSchema(schema, $ref, 'map', model, CodegenMapTypePurpose.PARENT, state)
			model.parentNativeType = result.nativeType
			model.componentSchema = result.componentSchema
		} else if (schema.discriminator) {
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
			if (!model.discriminatorValues) {
				model.discriminatorValues = []
			}
			model.discriminatorValues.push({
				model: discriminatorModel,
				value: state.generator.toLiteral(discriminatorValue, {
					...discriminator, 
					required: true,
				}),
			})
			discriminator.references.push({
				model,
				name: discriminatorValue,
			})
		}
	}

	/* Check properties */
	model.properties = nullIfEmpty(model.properties)

	/* Add to scope */
	if (!partial) {
		addToScope(model, scope, state)
	}
	return model
}

function toCodegenProperties(schema: OpenAPIX.SchemaObject, scope: CodegenScope, state: InternalCodegenState): CodegenProperties | undefined {
	if (typeof schema.properties !== 'object') {
		return undefined
	}

	const properties: CodegenProperties = idx.create()
	for (const propertyName in schema.properties) {
		const required = typeof schema.required === 'object' ? schema.required.indexOf(propertyName) !== -1 : false
		const propertySchema = schema.properties[propertyName]
		const property = toCodegenProperty(propertyName, propertySchema, required, scope, state)
		idx.set(properties, property.name, property)
	}

	return idx.undefinedIfEmpty(properties)
}

function toCodegenProperty(name: string, schema: OpenAPIX.SchemaObject, required: boolean, scope: CodegenScope | null, state: InternalCodegenState): CodegenProperty {
	/* We allow preserving the original description if the usage is by reference */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const description = isOpenAPIReferenceObject(schema) ? (schema as any).description : undefined

	const schemaUsage = toCodegenSchemaUsage(schema, required, name, CodegenSchemaPurpose.PROPERTY, scope, state)
	return {
		...schemaUsage,
		name,
		description: description || schemaUsage.schema.description || null,
		initialValue: schemaUsage.defaultValue || state.generator.toDefaultValue(undefined, schemaUsage),
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
