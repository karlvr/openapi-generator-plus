import { CodegenArrayTypePurpose, CodegenDiscriminator, CodegenDiscriminatorMappings, CodegenEnumValues, CodegenLiteralValueOptions, CodegenMapTypePurpose, CodegenModel, CodegenModels, CodegenNativeType, CodegenProperties, CodegenProperty, CodegenSchema, CodegenSchemaUse, CodegenSchemaNameOptions, CodegenSchemaPurpose, CodegenSchemaType, CodegenScope, CodegenTypePurpose } from '@openapi-generator-plus/types'
import { isOpenAPIReferenceObject, isOpenAPIV2Document, isOpenAPIv3SchemaObject } from '../openapi-type-guards'
import { InternalCodegenState } from '../types'
import { OpenAPIX } from '../types/patches'
import { coalesce, extractCodegenSchemaInfo, extractCodegenTypeInfo, fixSchema, nameFromRef, resolveReference } from './utils'
import { toCodegenVendorExtensions } from './vendor-extensions'
import * as idx from '@openapi-generator-plus/indexed-type'
import { OpenAPIV2, OpenAPIV3 } from 'openapi-types'
import { nullIfEmpty } from '@openapi-generator-plus/indexed-type'
import { toCodegenExamples } from './examples'

export function toCodegenModels(specModels: OpenAPIV2.DefinitionsObject | Record<string, OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject>, state: InternalCodegenState): void {
	/* Collect defined schema names first, so no inline or external models can use those names */
	for (const schemaName in specModels) {
		const fqmn = fullyQualifiedModelName([schemaName])
		state.usedModelFullyQualifiedNames[fqmn] = true
		state.reservedNames[refForSchemaName(schemaName, state)] = fqmn
	}

	for (const schemaName in specModels) {
		/* We load the model using a reference as we use references to distinguish between explicit and inline models */
		const reference: OpenAPIX.ReferenceObject = {
			$ref: refForSchemaName(schemaName, state),
		}

		toCodegenSchema(reference, schemaName, null, state)
	}
}

/**
 * Returns the value of the `$ref` to use to refer to the given schema definition / component.
 * @param schemaName the name of a schema
 * @param state 
 */
function refForSchemaName(schemaName: string, state: InternalCodegenState): string {
	return isOpenAPIV2Document(state.root) ? `#/definitions/${schemaName}` : `#/components/schemas/${schemaName}`
}

export function toCodegenSchemaUse(schema: OpenAPIX.SchemaObject, required: boolean, suggestedName: string, purpose: CodegenSchemaPurpose, scope: CodegenScope | null, state: InternalCodegenState): CodegenSchemaUse {
	/* Use purpose to refine the suggested name */
	suggestedName = state.generator.toSuggestedSchemaName(suggestedName, {
		purpose,
		schemaType: toCodegenSchemaTypeFromSchema(schema, state),
	})

	const schemaObject = toCodegenSchema(schema, suggestedName, scope, state)
	const result: CodegenSchemaUse = {
		...extractCodegenSchemaInfo(schemaObject),
		required,
		schema: schemaObject,
		examples: null,
		defaultValue: null,
	}
	if (result.schemaType !== CodegenSchemaType.OBJECT && result.schemaType !== CodegenSchemaType.ENUM && result.schemaType !== CodegenSchemaType.ARRAY && result.schemaType !== CodegenSchemaType.MAP) {
		result.nativeType = state.generator.toNativeType({
			type: result.type,
			format: result.format,
			vendorExtensions: schemaObject.vendorExtensions,
			purpose: CodegenTypePurpose.KEY,
			required,
		})
	}

	result.examples = schema.example ? toCodegenExamples(schema.example, undefined, undefined, result, state) : null
	result.defaultValue = schema.default ? state.generator.toDefaultValue(schema.default, {
		...result,
		required,
	}) : null

	return result
}

function toCodegenSchema(schema: OpenAPIX.SchemaObject, suggestedName: string, scope: CodegenScope | null, state: InternalCodegenState): CodegenSchema {
	let type: string
	let format: string | undefined
	let nativeType: CodegenNativeType
	let componentSchema: CodegenSchema | undefined
	let schemaType: CodegenSchemaType
	let model: CodegenModel | undefined

	const originalSchema = schema
	schema = resolveReference(schema, state)
	fixSchema(schema, state)

	if (isModelSchema(schema, state)) {
		model = toCodegenModel(suggestedName, false, scope, originalSchema, state)
		type = model.type
		format = model.format || undefined
		nativeType = model.propertyNativeType
		schemaType = model.schemaType
	} else {
		if (schema.type === 'array') {
			if (!schema.items) {
				throw new Error('items missing for schema type "array"')
			}
			type = 'array'
			schemaType = CodegenSchemaType.ARRAY
	
			const result = handleArraySchema(originalSchema, suggestedName, scope, CodegenArrayTypePurpose.PROPERTY, state)
			componentSchema = result.componentSchema
			nativeType = result.nativeType
		} else if (schema.type === 'object') {
			if (schema.additionalProperties) {
				type = 'object'
				schemaType = CodegenSchemaType.MAP

				const result = handleMapSchema(originalSchema, suggestedName, scope, CodegenMapTypePurpose.PROPERTY, state)
				nativeType = result.nativeType
				componentSchema = result.componentSchema
			} else {
				throw new Error('Unsupported object schema type in toCodegenProperty')
			}
		} else if (typeof schema.type === 'string') {
			type = schema.type
			format = schema.format
			nativeType = state.generator.toNativeType({
				type,
				format,
				required: true,
				vendorExtensions: toCodegenVendorExtensions(schema),
				purpose: CodegenTypePurpose.PROPERTY,
			})
			schemaType = toCodegenSchemaType(type, format, false, false)
		} else {
			throw new Error(`Unsupported schema type "${schema.type}" for property in ${JSON.stringify(schema)}`)
		}
	}

	const result: CodegenSchema = {
		description: coalesce(originalSchema.description, schema.description) || null,
		title: coalesce(originalSchema.title, schema.title) || null,
		readOnly: coalesce(originalSchema.readOnly != undefined ? !!originalSchema.readOnly : undefined, schema.readOnly !== undefined ? !!schema.readOnly : undefined) || false,
		nullable: false, /* Set below for OpenAPI V3 */
		writeOnly: false, /* Set below for OpenAPI V3 */
		deprecated: false, /* Set below for OpenAPI V3 */
		vendorExtensions: toCodegenVendorExtensions(schema),

		type,
		format: schema.format || null,
		schemaType,
		nativeType,

		/* Validation */
		maximum: coalesce(originalSchema.maximum, schema.maximum) || null,
		exclusiveMaximum: coalesce(originalSchema.exclusiveMaximum, schema.exclusiveMaximum) || null,
		minimum: coalesce(originalSchema.minimum, schema.minimum) || null,
		exclusiveMinimum: coalesce(originalSchema.exclusiveMinimum, schema.exclusiveMinimum) || null,
		maxLength: coalesce(originalSchema.maxLength, schema.maxLength) || null,
		minLength: coalesce(originalSchema.minLength, schema.minLength) || null,
		pattern: coalesce(originalSchema.pattern, schema.pattern) || null,
		maxItems: coalesce(originalSchema.maxItems, schema.maxItems) || null,
		minItems: coalesce(originalSchema.minItems, schema.minItems) || null,
		uniqueItems: coalesce(originalSchema.uniqueItems, schema.uniqueItems) || null,
		multipleOf: coalesce(originalSchema.multipleOf, schema.multipleOf) || null,

		/* Model */
		model: model || null,
		componentSchema: componentSchema || null,
	}

	if (isOpenAPIv3SchemaObject(originalSchema, state.specVersion) && isOpenAPIv3SchemaObject(schema, state.specVersion)) {
		result.nullable = coalesce(originalSchema.nullable, schema.nullable) || false
		result.writeOnly = coalesce(originalSchema.writeOnly, schema.writeOnly) || false
		result.deprecated = coalesce(originalSchema.deprecated, schema.deprecated) || false
	}

	return result
}

export function toCodegenSchemaType(type: string, format: string | undefined, isEnum: boolean, isMap: boolean): CodegenSchemaType {
	if (isMap) {
		return CodegenSchemaType.MAP
	} else if (isEnum) {
		return CodegenSchemaType.ENUM
	} else if (type === 'object') {
		return CodegenSchemaType.OBJECT
	} else if (type === 'array') {
		return CodegenSchemaType.ARRAY
	} else if (type === 'boolean') {
		return CodegenSchemaType.BOOLEAN
	} else if (type === 'number' || type === 'integer') {
		return CodegenSchemaType.NUMBER
	} else if (type === 'string' && format === 'date-time') {
		return CodegenSchemaType.DATETIME
	} else if (type === 'string' && format === 'date') {
		return CodegenSchemaType.DATE
	} else if (type === 'string' && format === 'time') {
		return CodegenSchemaType.TIME
	} else if (type === 'string') {
		return CodegenSchemaType.STRING
	} else if (type === 'file') {
		return CodegenSchemaType.FILE
	} else {
		throw new Error(`Unsupported schema type: ${type}`)
	}
}

function toCodegenSchemaTypeFromSchema(schema: OpenAPIX.SchemaObject, state: InternalCodegenState): CodegenSchemaType {
	schema = resolveReference(schema, state)
	fixSchema(schema, state)

	if (schema.allOf) {
		return CodegenSchemaType.OBJECT
	} else if (schema.anyOf) {
		return CodegenSchemaType.OBJECT
	} else if (schema.oneOf) {
		return CodegenSchemaType.OBJECT
	}

	if (schema.enum) {
		return toCodegenSchemaType(typeof schema.type === 'string' ? schema.type : 'object', schema.format, true, false)
	} else if (schema.type === 'object' && schema.additionalProperties) {
		return toCodegenSchemaType(schema.type, schema.format, false, true)
	} else if (typeof schema.type === 'string') {
		return toCodegenSchemaType(schema.type, schema.format, false, false)
	} else {
		throw new Error(`Invalid schema type "${schema.type}": ${JSON.stringify(schema)}`)
	}
}


interface HandleSchemaResult {
	componentSchema: CodegenSchema
	nativeType: CodegenNativeType
}

function handleArraySchema(schema: OpenAPIX.SchemaObject, suggestedItemModelName: string, scope: CodegenScope | null, purpose: CodegenArrayTypePurpose, state: InternalCodegenState): HandleSchemaResult {
	if (isOpenAPIReferenceObject(schema)) {
		/* This schema is a reference, so our item schema shouldn't be nested in whatever parent
		   scope we came from.
		 */
		const possibleName = nameFromRef(schema.$ref)
		if (possibleName) {
			suggestedItemModelName = possibleName
		}
		scope = null
	}

	schema = resolveReference(schema, state)

	if (schema.type !== 'array') {
		throw new Error('Not an array schema')
	}

	if (!schema.items) {
		throw new Error('items missing for schema type "array"')
	}

	/* Component properties are implicitly required as we don't expect to have `null` entries in the array. */
	const componentSchema = toCodegenSchemaUse(schema.items, true, suggestedItemModelName, CodegenSchemaPurpose.ARRAY_ITEM, scope, state)
	const nativeType = state.generator.toNativeArrayType({
		componentNativeType: componentSchema.nativeType,
		uniqueItems: schema.uniqueItems,
		purpose,
		vendorExtensions: toCodegenVendorExtensions(schema),
	})

	return {
		componentSchema: componentSchema.schema,
		nativeType,
	}
}

function handleMapSchema(schema: OpenAPIX.SchemaObject, suggestedName: string, scope: CodegenScope | null, purpose: CodegenMapTypePurpose, state: InternalCodegenState): HandleSchemaResult {
	if (isOpenAPIReferenceObject(schema)) {
		/* This schema is a reference, so our item schema shouldn't be nested in whatever parent
		   scope we came from.
		 */
		const possibleName = nameFromRef(schema.$ref)
		if (possibleName) {
			suggestedName = possibleName
		}
		scope = null
	}

	schema = resolveReference(schema, state)
	
	const keyNativeType = state.generator.toNativeType({
		type: 'string',
		purpose: CodegenTypePurpose.KEY,
		required: true,
		vendorExtensions: toCodegenVendorExtensions(schema),
	})
	const componentSchema = toCodegenSchemaUse(schema.additionalProperties, true, suggestedName, CodegenSchemaPurpose.MAP_VALUE, scope, state)

	const nativeType = state.generator.toNativeMapType({
		keyNativeType,
		componentNativeType: componentSchema.nativeType,
		vendorExtensions: toCodegenVendorExtensions(schema),
		purpose,
	})

	return {
		componentSchema: componentSchema.schema,
		nativeType,
	}
}

function isModelSchema(schema: OpenAPIX.SchemaObject, state: InternalCodegenState): boolean {
	const resolvedSchema = resolveReference(schema, state)

	if (resolvedSchema.enum || (resolvedSchema.type === 'object' && !resolvedSchema.additionalProperties) ||
		resolvedSchema.allOf || resolvedSchema.anyOf || resolvedSchema.oneOf) {
		return true
	}

	if (resolvedSchema.type === 'array' && state.generator.generateCollectionModels && state.generator.generateCollectionModels()) {
		return true
	}

	if (resolvedSchema.type === 'object' && resolvedSchema.additionalProperties && state.generator.generateCollectionModels && state.generator.generateCollectionModels()) {
		return true
	}

	return false
}

function toCodegenModel(suggestedName: string, partial: boolean, suggestedScope: CodegenScope | null, schema: OpenAPIX.SchemaObject, state: InternalCodegenState): CodegenModel {
	const $ref = isOpenAPIReferenceObject(schema) ? schema.$ref : undefined
	const { scopedName, scope } = partial ? toScopedName(suggestedName, suggestedScope, schema, state) : toUniqueScopedName(suggestedName, suggestedScope, schema, state)
	const name = scopedName[scopedName.length - 1]
	
	schema = resolveReference(schema, state)

	/* Check if we've already generated this model, and return it */
	const existing = state.modelsBySchema.get(schema)
	if (existing) {
		return existing
	}

	fixSchema(schema, state)

	const nativeType = state.generator.toNativeObjectType({
		purpose: CodegenTypePurpose.MODEL,
		modelNames: scopedName,
		vendorExtensions: toCodegenVendorExtensions(schema),
	})

	const propertyNativeType = state.generator.toNativeObjectType({
		purpose: CodegenTypePurpose.PROPERTY,
		modelNames: scopedName,
		vendorExtensions: toCodegenVendorExtensions(schema),
	})

	const vendorExtensions = toCodegenVendorExtensions(schema)

	const model: CodegenModel = {
		name,
		serializedName: $ref ? (nameFromRef($ref) || null) : null,
		scopedName,
		description: schema.description || null,
		properties: null,
		examples: null,
		discriminator: null,
		discriminatorValues: null,
		children: null,
		isInterface: false,
		vendorExtensions,
		nativeType,
		propertyNativeType,
		type: 'object',
		format: schema.format,
		schemaType: toCodegenSchemaTypeFromSchema(schema, state),
		implements: null,
		implementors: null,
		enumValueNativeType: null,
		enumValues: null,
		parent: null,
		parentNativeType: null,
		models: null,
		componentSchema: null,
		deprecated: false,
	}

	// TODO models should be able to get the example from the schema
	// model.examples = toCodegenExamples(schema.example, undefined, undefined, model, state)

	if (isOpenAPIv3SchemaObject(schema, state.specVersion)) {
		model.deprecated = schema.deprecated || false
	}

	/* Add to known models */
	if (!partial) {
		state.usedModelFullyQualifiedNames[fullyQualifiedModelName(scopedName)] = true
		state.modelsBySchema.set(schema, model)
	}

	model.properties = toCodegenModelProperties(schema, model, state) || null

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
	function absorbModels(otherModels: CodegenModels) {
		for (const otherModel of idx.allValues(otherModels)) {
			if (!model.models) {
				model.models = idx.create()
			}
			idx.set(model.models, otherModel.name, otherModel)
		}
	}

	function absorbSchema(otherSchema: OpenAPIX.SchemaObject) {
		/* If the other schema is inline, then we create it as a PARTIAL MODEL, so it doesn't get recorded anywhere
		   (we don't want it to actually exist). We also give it exactly the same name and scope as this model
		   (which is only possible for partial models, as we don't unique their names), so that any submodels that
		   it creates end up scoped to this model.
		 */
		if (isOpenAPIReferenceObject(otherSchema)) {
			const otherSchemaObject = toCodegenSchema(otherSchema, name, scope, state)
			const otherSchemaModel = otherSchemaObject.model
			if (!otherSchemaModel) {
				throw new Error(`Cannot absorb schema as it isn't a model: ${otherSchema}`)
			}

			/* We only include nested models if the model being observed won't actually exist to contain its nested models itself */
			absorbModel(otherSchemaModel, { includeNestedModels: false })
			return otherSchemaModel
		} else {
			const otherSchemaModel = toCodegenModel(name, true, scope, otherSchema, state)
			/* We only include nested models if the model being observed won't actually exist to contain its nested models itself */
			absorbModel(otherSchemaModel, { includeNestedModels: true })
			return otherSchemaModel
		}		
	}

	function absorbModel(otherModel: CodegenModel, options: { includeNestedModels?: boolean; makePropertiesOptional?: boolean }) {
		if (otherModel.parent) {
			absorbModel(otherModel.parent, options)
		}
		if (otherModel.properties) {
			absorbProperties(otherModel.properties, { makePropertiesOptional: options.makePropertiesOptional })
		}
		if (options.includeNestedModels && otherModel.models) {
			absorbModels(otherModel.models)
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
				const parentSchema = toCodegenSchema(possibleParentSchema, 'parent', suggestedScope, state)
				const parentModel = parentSchema.model

				/* If the parent model is an interface then we cannot use it as a parent */
				if (parentModel && !parentModel.isInterface) {
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
			const subSchemaObject = toCodegenSchema(subSchema, 'submodel', model, state)
			const subModel = subSchemaObject.model
			if (!subModel) {
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
				nativeType: state.generator.toNativeType({ type: 'string', required: true, purpose: CodegenTypePurpose.DISCRIMINATOR }),
			}
			
			for (const subSchema of oneOf) {
				const subSchemaObject = toCodegenSchema(subSchema, 'submodel', model, state)
				const subModel = subSchemaObject.model
				if (!subModel) {
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
				const subSchemaObject = toCodegenSchema(subSchema, 'submodel', model, state)
				const subModel = subSchemaObject.model
				if (subModel) {
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
					const fakeName = toUniqueScopedName('fake', model, subSchema, state)
					const fakeModel: CodegenModel = {
						...subSchemaObject,
						name: fakeName.scopedName[fakeName.scopedName.length - 1],
						serializedName: null,
						properties: null,
						examples: null,
						discriminator: null,
						discriminatorValues: null,
						children: null,
						isInterface: false,
						propertyNativeType: subSchemaObject.nativeType,
						scopedName: fakeName.scopedName,
						implements: null,
						implementors: null,
						enumValueNativeType: null,
						enumValues: null,
						parent: null,
						parentNativeType: null,
						models: null,
					}
					fakeModel.implements = idx.create()
					idx.set(fakeModel.implements, model.name, model)
					if (!model.implementors) {
						model.implementors = idx.create()
					}
					idx.set(model.implementors, fakeModel.name, fakeModel)

					state.usedModelFullyQualifiedNames[fullyQualifiedModelName(fakeName.scopedName)] = true
				}
			}
		}
	} else if (schema.enum) {
		const enumValueType = 'string'
		const enumValueFormat = schema.format
		const enumValuePropertyType = toCodegenSchemaType(enumValueType, enumValueFormat, false, false)

		const enumValueNativeType = state.generator.toNativeType({
			type: enumValueType,
			format: schema.format,
			purpose: CodegenTypePurpose.ENUM,
			required: true,
			vendorExtensions: toCodegenVendorExtensions(schema),
		})

		const enumValueLiteralOptions: CodegenLiteralValueOptions = {
			type: enumValueType,
			format: enumValueFormat,
			schemaType: enumValuePropertyType,
			nativeType: enumValueNativeType,
			required: true,
		}
		
		const enumValues: CodegenEnumValues | undefined = schema.enum ? idx.create(schema.enum.map(name => ([`${name}`, {
			name: state.generator.toEnumMemberName(`${name}`),
			literalValue: state.generator.toLiteral(`${name}`, enumValueLiteralOptions),
			value: `${name}`,
		}]))) : undefined

		if (enumValues) {
			model.enumValueNativeType = enumValueNativeType
			model.enumValues = idx.nullIfEmpty(enumValues)
		}
	} else if (schema.type === 'array') {
		if (!state.generator.generateCollectionModels || !state.generator.generateCollectionModels()) {
			throw new Error(`Illegal entry into toCodegenModel for array schema when we do not generate collection models: ${schema}`)
		}

		const result = handleArraySchema(schema, 'array', model, CodegenArrayTypePurpose.PARENT, state)
		model.parentNativeType = result.nativeType
		model.componentSchema = result.componentSchema
	} else if (schema.type === 'object') {
		if (schema.additionalProperties) {
			if (!state.generator.generateCollectionModels || !state.generator.generateCollectionModels()) {
				throw new Error(`Illegal entry into toCodegenModel for map schema when we do not generate collection models: ${schema}`)
			}

			const result = handleMapSchema(schema, 'map', model, CodegenMapTypePurpose.PARENT, state)
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
		   and they shouldn't get into toCodegenModel. */
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
		if (scope) {
			if (!scope.models) {
				scope.models = idx.create()
			}
			idx.set(scope.models, model.name, model)
		} else {
			idx.set(state.models, model.name, model)
		}
	}
	return model
}

function toCodegenProperty(name: string, schema: OpenAPIX.SchemaObject, required: boolean, scope: CodegenScope | null, state: InternalCodegenState): CodegenProperty {
	const schemaUse = toCodegenSchemaUse(schema, required, name, CodegenSchemaPurpose.PROPERTY, scope, state)
	return {
		...schemaUse,
		name,
		description: schemaUse.schema.description,
		initialValue: schemaUse.defaultValue || state.generator.toDefaultValue(undefined, schemaUse),
	}
}

/**
 * Returns a fully qualified model name using an internal format for creating fully qualified
 * model names. This format does not need to reflect a native format as it is only used internally
 * to track unique model names.
 * @param name the model name
 * @param scopeNames the enclosing model names, if any
 */
function fullyQualifiedModelName(scopedName: string[]): string {
	return scopedName.join('.')
}

/**
 * Returns a unique model name for a proposed model name.
 * @param proposedName the proposed model name
 * @param scopeNames the enclosing model names, if any
 * @param state the state
 */
function uniqueModelName(scopedName: string[], state: InternalCodegenState): string[] {
	if (!state.usedModelFullyQualifiedNames[fullyQualifiedModelName(scopedName)]) {
		return scopedName
	}

	const proposedName = scopedName[scopedName.length - 1]
	const scopeNames = scopedName.slice(0, scopedName.length - 1)
	let name = proposedName
	let iteration = 0
	do {
		iteration += 1
		name = state.generator.toIteratedSchemaName(proposedName, scopeNames, iteration)
	} while (state.usedModelFullyQualifiedNames[fullyQualifiedModelName([...scopeNames, name])])

	return [...scopeNames, name]
}

function toCodegenModelProperties(schema: OpenAPIX.SchemaObject, scope: CodegenScope, state: InternalCodegenState): CodegenProperties | undefined {
	schema = resolveReference(schema, state)

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

interface ScopedModelInfo {
	scopedName: string[]
	scope: CodegenScope | null
}

function toScopedName(suggestedName: string, scope: CodegenScope | null, schema: OpenAPIX.SchemaObject, state: InternalCodegenState): ScopedModelInfo {
	if (isOpenAPIReferenceObject(schema)) {
		/* We always want referenced schemas to be at the top-level */
		scope = null

		const refName = nameFromRef(schema.$ref)
		if (refName) {
			suggestedName = refName
		}

		/* Resolve the schema for the following checks */
		schema = resolveReference(schema, state)
	}

	const vendorExtensions = toCodegenVendorExtensions(schema)
	/* Support vendor extension to override the automatic naming of schemas */
	if (vendorExtensions && vendorExtensions['x-schema-name']) {
		suggestedName = vendorExtensions['x-schema-name']
	}

	const nameOptions: CodegenSchemaNameOptions = {
		schemaType: toCodegenSchemaTypeFromSchema(schema, state),
	}
	let name = state.generator.toSchemaName(suggestedName, nameOptions)

	if (scope) {
		/* Check that our name is unique in our scope, as some languages (Java) don't allow an inner class to shadow an ancestor */
		const originalName = name
		let iteration = 0
		while (scope.scopedName.indexOf(name) !== -1) {
			iteration += 1
			name = state.generator.toIteratedSchemaName(originalName, scope.scopedName, iteration)
		}

		return {
			scopedName: [...scope.scopedName, name],
			scope,
		}
	} else {
		return {
			scopedName: [name],
			scope: null,
		}
	}
}

function toUniqueScopedName(suggestedName: string, scope: CodegenScope | null, schema: OpenAPIX.SchemaObject, state: InternalCodegenState) {
	const result = toScopedName(suggestedName, scope, schema, state)

	const reservedName = isOpenAPIReferenceObject(schema) ? state.reservedNames[schema.$ref] : undefined
	if (reservedName !== fullyQualifiedModelName(result.scopedName)) {
		/* Model types that aren't defined in the spec need to be made unique */
		result.scopedName = uniqueModelName(result.scopedName, state)
	}

	return result
}

function findDiscriminatorMapping(discriminator: CodegenDiscriminator, ref: string): string | undefined {
	if (discriminator.mappings) {
		return discriminator.mappings[ref]
	} else {
		return undefined
	}
}

function findClosestDiscriminatorModel(model: CodegenModel): CodegenModel | undefined {
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
