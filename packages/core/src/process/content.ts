import { CodegenContent, CodegenContentEncoding, CodegenContentEncodingType, CodegenContentPropertyEncoding, CodegenExamples, CodegenLogLevel, CodegenMediaType, CodegenProperty, CodegenSchemaPurpose, CodegenSchemaUsage, CodegenScope, isCodegenObjectSchema, CodegenSchemaType, CodegenEncodingStyle } from '@openapi-generator-plus/types'
import { OpenAPIV3 } from 'openapi-types'
import { idx } from '..'
import { InternalCodegenState } from '../types'
import { uniquePropertiesIncludingInherited } from '@openapi-generator-plus/utils'
import { toCodegenExamples } from './examples'
import { toCodegenHeaders } from './headers'
import { isMultipart, toCodegenMediaType } from './media-types'
import { toCodegenSchemaUsage } from './schema'
import { createArraySchema } from './schema/array'
import { toUniqueName } from './schema/naming'
import { createObjectSchema } from './schema/object'
import { addCodegenProperty, createCodegenProperty } from './schema/property'
import { createStringSchemaUsage } from './schema/string'
import { createSchemaUsage, transformNativeTypeForUsage } from './schema/usage'
import { addToScope } from './schema/utils'
import { convertToBoolean, extractCodegenSchemaInfo, toCodegenInitialValueOptions } from './utils'
import { toCodegenVendorExtensions } from './vendor-extensions'

export function toCodegenContentArray(content: { [media: string]: OpenAPIV3.MediaTypeObject }, required: boolean, suggestedSchemaName: string, purpose: CodegenSchemaPurpose, scope: CodegenScope | null, state: InternalCodegenState): CodegenContent[] {
	const result: CodegenContent[] = []
	for (const mediaType in content) {
		const mediaTypeContent = content[mediaType]
		const item = toCodegenContent(mediaType, mediaTypeContent, required, suggestedSchemaName, purpose, scope, state)
		result.push(item)
	}

	return result
}

function toCodegenContent(mediaType: string, mediaTypeContent: OpenAPIV3.MediaTypeObject, required: boolean, suggestedSchemaName: string, purpose: CodegenSchemaPurpose, scope: CodegenScope | null, state: InternalCodegenState): CodegenContent {
	if (!mediaTypeContent.schema) {
		return {
			mediaType: toCodegenMediaType(mediaType),
			encoding: null,
			required,
			schema: null,
			nativeType: null,
			examples: null,
		}
	}
	const schemaUse = toCodegenSchemaUsage(mediaTypeContent.schema, state, {
		required,
		suggestedName: suggestedSchemaName,
		purpose,
		suggestedScope: scope,
	})

	const examples: CodegenExamples | null = toCodegenExamples(mediaTypeContent.example, mediaTypeContent.examples, mediaType, schemaUse, state)

	const item: CodegenContent = {
		mediaType: toCodegenMediaType(mediaType),
		encoding: null,
		required,
		schema: schemaUse.schema,
		nativeType: schemaUse.nativeType,
		examples,
	}
	applyCodegenContentEncoding(item, mediaTypeContent.encoding, state)
	return item
}

export function findAllContentMediaTypes(contents: CodegenContent[] | undefined): CodegenMediaType[] | undefined {
	if (!contents || !contents.length) {
		return undefined
	}

	return contents.reduce((existing, content) => content.mediaType ? [...existing, content.mediaType] : existing, [] as CodegenMediaType[])
}

/**
 * Determine the content encoding type to use with the given media type, or null if content encoding isn't supported.
 * @param mediaType 
 * @returns 
 */
function contentEncodingType(mediaType: CodegenMediaType): CodegenContentEncodingType | null {
	if (isMultipart(mediaType)) {
		return CodegenContentEncodingType.MULTIPART
	} else if (mediaType.mimeType === 'application/x-www-form-urlencoded') {
		return CodegenContentEncodingType.WWW_FORM_URLENCODED
	} else {
		return null
	}
}

/**
 * Apply information about encoding, and any required defaults for content encoding, to the given CodegenContent; modifying it.
 * @param content 
 * @param encodingSpec 
 * @param state 
 * @returns 
 */
export function applyCodegenContentEncoding(content: CodegenContent, encodingSpec: { [name: string]: OpenAPIV3.EncodingObject } | undefined, state: InternalCodegenState): void {
	if (!content.schema) {
		throw new Error('Cannot apply content encoding to content without a schema')
	}

	const type = contentEncodingType(content.mediaType)
	if (!type) {
		if (encodingSpec) {
			state.log(CodegenLogLevel.WARN, `encoding object found but not supported on content type ${content.mediaType.mediaType}`)
		}
		content.encoding = null
		return
	}

	if (!isCodegenObjectSchema(content.schema)) {
		state.log(CodegenLogLevel.WARN, `encoding object found but content schema is not an object for content type ${content.mediaType.mediaType}`)
		return
	}
	
	if (!encodingSpec) {
		encodingSpec = {}
	}
	
	const allProperties = uniquePropertiesIncludingInherited(content.schema)
	
	/* Ensure `encodings` has one entry per property in the schema, as we make encodings a complete representation of the schema */
	for (const name in allProperties) {
		if (!encodingSpec[name]) {
			encodingSpec[name] = {}
		}
		const encoding = encodingSpec[name]
		if (!encoding.contentType) {
			encoding.contentType = defaultContentType(allProperties[name])
		}
	}

	const supportsHeaders = type === CodegenContentEncodingType.MULTIPART

	const encoding: CodegenContentEncoding = {
		type,
		mediaType: content.mediaType,
		properties: {},
	}
	for (const name in encodingSpec) {
		const property = idx.get(allProperties, name)
		if (!property) {
			state.log(CodegenLogLevel.WARN, `encoding object specifies unknown property "${name}" for content type ${content.mediaType.mediaType}`)
			continue
		}

		const propertyEncodingSpec = encodingSpec[name]
		const contentType = propertyEncodingSpec.contentType || 'text/plain'
		const style = propertyEncodingSpec.style || CodegenEncodingStyle.FORM

		const propertyEncoding: CodegenContentPropertyEncoding = {
			contentType,
			headers: supportsHeaders ? toCodegenHeaders(propertyEncodingSpec.headers, state) : null,
			style,
			explode: convertToBoolean(propertyEncodingSpec.explode, style === CodegenEncodingStyle.FORM),
			allowReserved: convertToBoolean(propertyEncodingSpec.allowReserved, false),
			allowEmptyValue: false,
			vendorExtensions: toCodegenVendorExtensions(propertyEncodingSpec),
			property: property,
			valueProperty: null,
			filenameProperty: null,
			headerProperties: null,
		}
		encoding.properties[name] = propertyEncoding
	}
	content.encoding = encoding

	if (requiresMetadata(content.encoding)) {
		const newSchema = createObjectSchema(content.mediaType.mimeType, content.schema, CodegenSchemaPurpose.GENERAL, state)
		newSchema.properties = idx.create(allProperties)

		for (const name of idx.allKeys(newSchema.properties)) {
			const propertyEncoding = idx.get(encoding.properties, name)!
			if (propertyRequiresMetadata(encoding, propertyEncoding)) {
				const originalProperty = allProperties[name]
				const partSchema = createObjectSchema(`${name}_part`, newSchema, CodegenSchemaPurpose.GENERAL, state)

				/* Duplicate the property so we don't change the original */
				const partProperty: CodegenProperty = {
					...originalProperty,
				}
				if (originalProperty.schema.schemaType === CodegenSchemaType.ARRAY) {
					const partComponentSchemaUsage = createSchemaUsage(partSchema, {
						required: true,
						nullable: originalProperty.schema.component!.nullable,
						readOnly: false,
						writeOnly: false,
					}, state)
					partProperty.schema = createArraySchema(partComponentSchemaUsage, state)
					partProperty.nativeType = transformNativeTypeForUsage(partProperty, state)
				} else {
					const partSchemaUsage = createSchemaUsage(partSchema, {
						required: originalProperty.required,
						nullable: originalProperty.nullable,
						readOnly: originalProperty.readOnly,
						writeOnly: originalProperty.writeOnly,
					}, state)
					Object.assign(partProperty, partSchemaUsage)
				}
				partProperty.initialValue = state.generator.initialValue(toCodegenInitialValueOptions(partProperty))
				idx.set(newSchema.properties, name, partProperty)
				addToScope(partSchema, newSchema, state)

				propertyEncoding.property = partProperty

				partSchema.properties = idx.create()

				/* Value property contains the actual value */
				const valueProperty = createCodegenProperty('value', {
					...(originalProperty.schema.component ? originalProperty.schema.component : originalProperty),
					required: true, /* As if there's no value, our container shouldn't be created */
					nullable: false,
					readOnly: false,
					writeOnly: false,
				}, state)
				addCodegenProperty(partSchema.properties, valueProperty, state)
				propertyEncoding.valueProperty = valueProperty

				/* Filename property */
				if (propertySupportsFilenameMetadata(encoding, propertyEncoding)) {
					const filenameProperty = createCodegenProperty('filename', createStringSchemaUsage(undefined, {
						required: false,
					}, state), state)
					addCodegenProperty(partSchema.properties, filenameProperty, state)
					propertyEncoding.filenameProperty = filenameProperty
				}

				/* Header properties */
				if (propertyEncoding.headers) {
					propertyEncoding.headerProperties = idx.create()
					for (const [headerName, header] of idx.iterable(propertyEncoding.headers)) {
						const headerUsage: CodegenSchemaUsage = {
							...extractCodegenSchemaInfo(header.schema),
							schema: header.schema,
							defaultValue: header.defaultValue,
							examples: header.examples,
							required: header.required,
						}
						headerUsage.nativeType = transformNativeTypeForUsage(headerUsage, state)
						let headerProperty = createCodegenProperty(headerName, headerUsage, state)

						let uniquePropertyName = toUniqueName(headerProperty.name, undefined, partSchema.properties, state)
						if (uniquePropertyName !== headerProperty.name) {
							headerProperty = createCodegenProperty(`${headerName}_header`, headerUsage, state)
							uniquePropertyName = toUniqueName(headerProperty.name, undefined, partSchema.properties, state)
						}
						headerProperty.name = uniquePropertyName
						headerProperty.serializedName = uniquePropertyName /* We don't use the serialized name, but it impacts the key it gets put in in properties */

						addCodegenProperty(partSchema.properties, headerProperty, state)
						idx.set(propertyEncoding.headerProperties, headerName, headerProperty)
					}
				}
			}
		}

		/* Use the new schema in our content */
		Object.assign(content, createSchemaUsage(
			newSchema,
			{
				required: false,
				nullable: false,
				readOnly: false,
				writeOnly: false,
			},
			state
		))
	}
}

/**
 * Determine whether the given content encoding requires us to add additional metadata to the schema,
 * such as for headers that might be required, or filenames.
 * @param encoding 
 * @returns 
 */
function requiresMetadata(encoding: CodegenContentEncoding): boolean {
	if (encoding.type !== CodegenContentEncodingType.MULTIPART) {
		return false
	}

	for (const name of idx.allKeys(encoding.properties)) {
		const propertyEncoding = encoding.properties[name]
		if (propertyRequiresMetadata(encoding, propertyEncoding)) {
			return true
		}
	}

	return false
}

function propertyRequiresMetadata(encoding: CodegenContentEncoding, propertyEncoding: CodegenContentPropertyEncoding): boolean {
	if (propertyEncoding.headers) {
		return true
	}
	if (propertySupportsFilenameMetadata(encoding, propertyEncoding)) {
		return true
	}
	return false	
}

function propertySupportsFilenameMetadata(encoding: CodegenContentEncoding, propertyEncoding: CodegenContentPropertyEncoding): boolean {
	if (encoding.mediaType.mimeType === 'multipart/form-data' && propertyEncoding.contentType === 'application/octet-stream') {
		return true
	}
	return false
}

/**
 * Returns the default content type to use for a multipart part witht he given schema, using defaults
 * described in https://swagger.io/specification/#encoding-object
 */
function defaultContentType(usage: CodegenSchemaUsage): string {
	if (usage.schema.schemaType === CodegenSchemaType.BINARY) {
		return 'application/octet-stream'
	} else if (usage.schema.schemaType === CodegenSchemaType.OBJECT) {
		return 'application/json'
	} else if (usage.schema.schemaType === CodegenSchemaType.ARRAY && usage.schema.component) {
		return defaultContentType(usage.schema.component)
	}
	return 'text/plain'
}
