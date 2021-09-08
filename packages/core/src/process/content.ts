import { CodegenContent, CodegenContentEncoding, CodegenContentEncodingType, CodegenContentPropertyEncoding, CodegenExamples, CodegenLogLevel, CodegenMediaType, CodegenProperty, CodegenSchemaPurpose, CodegenSchemaUsage, CodegenScope, isCodegenObjectSchema, CodegenSchemaType, CodegenEncodingStyle } from '@openapi-generator-plus/types'
import { OpenAPIV3 } from 'openapi-types'
import { idx } from '..'
import { InternalCodegenState } from '../types'
import { toCodegenExamples } from './examples'
import { toCodegenHeaders } from './headers'
import { isMultipart, toCodegenMediaType } from './media-types'
import { toCodegenSchemaUsage } from './schema'
import { toUniqueName } from './schema/naming'
import { createObjectSchemaUsage } from './schema/object'
import { addCodegenProperty, createCodegenProperty } from './schema/property'
import { createStringSchemaUsage } from './schema/string'
import { addToScope, uniquePropertiesIncludingInherited } from './schema/utils'
import { convertToBoolean } from './utils'
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
		throw new Error('Media type content without a schema')
	}
	const schemaUse = toCodegenSchemaUsage(mediaTypeContent.schema, state, {
		required,
		suggestedName: suggestedSchemaName,
		purpose,
		scope,
	})

	const examples: CodegenExamples | null = toCodegenExamples(mediaTypeContent.example, mediaTypeContent.examples, mediaType, schemaUse, state)

	const item: CodegenContent = {
		mediaType: toCodegenMediaType(mediaType),
		encoding: null,
		...schemaUse,
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
		const newSchemaUsage = createObjectSchemaUsage(content.mediaType.mimeType, content.schema, CodegenSchemaPurpose.MODEL, state)
		newSchemaUsage.schema.properties = idx.create(allProperties)

		for (const name of idx.allKeys(newSchemaUsage.schema.properties)) {
			const propertyEncoding = idx.get(encoding.properties, name)!
			if (propertyRequiresMetadata(encoding, propertyEncoding)) {
				const property = allProperties[name]
				const newPropertySchemaUsage = createObjectSchemaUsage(`${name}_part`, newSchemaUsage.schema, CodegenSchemaPurpose.MODEL, state)

				/* Duplicate the property so we don't change the original */
				const newProperty: CodegenProperty = {
					...property,
				}
				if (property.type === 'array') {
					newProperty.component = newPropertySchemaUsage
					newProperty.nativeType = state.generator.toNativeArrayType({
						type: 'array',
						schemaType: CodegenSchemaType.ARRAY,
						componentNativeType: newPropertySchemaUsage.nativeType,
					})
				} else {
					Object.assign(newProperty, newPropertySchemaUsage)
				}
				idx.set(newSchemaUsage.schema.properties, name, newProperty)
				addToScope(newPropertySchemaUsage.schema, newSchemaUsage.schema, state)

				propertyEncoding.property = newProperty

				newPropertySchemaUsage.schema.properties = idx.create()

				/* Value property contains the actual value */
				const valueProperty = createCodegenProperty('value', {
					...(property.component ? property.component : property),
					required: true, /* As if there's no value, our container shouldn't be created */
				}, state)
				addCodegenProperty(newPropertySchemaUsage.schema.properties, valueProperty, state)
				propertyEncoding.valueProperty = valueProperty

				/* Filename property */
				if (propertyRequiresFilenameMetadata(encoding, propertyEncoding)) {
					const filenameProperty = createCodegenProperty('filename', createStringSchemaUsage(state), state)
					addCodegenProperty(newPropertySchemaUsage.schema.properties, filenameProperty, state)
					propertyEncoding.filenameProperty = filenameProperty
				}

				/* Header properties */
				if (propertyEncoding.headers) {
					propertyEncoding.headerProperties = idx.create()
					for (const [headerName, header] of idx.iterable(propertyEncoding.headers)) {
						let headerProperty = createCodegenProperty(headerName, header, state)

						let uniquePropertyName = toUniqueName(headerProperty.name, undefined, newPropertySchemaUsage.schema.properties, state)
						if (uniquePropertyName !== headerProperty.name) {
							headerProperty = createCodegenProperty(`${headerName}_header`, header, state)
							uniquePropertyName = toUniqueName(headerProperty.name, undefined, newPropertySchemaUsage.schema.properties, state)
						}
						headerProperty.name = uniquePropertyName
						headerProperty.serializedName = uniquePropertyName /* We don't use the serialized name, but it impacts the key it gets put in in properties */

						addCodegenProperty(newPropertySchemaUsage.schema.properties, headerProperty, state)
						idx.set(propertyEncoding.headerProperties, headerName, headerProperty)
					}
				}
			}
		}

		/* Use the new schema in our content */
		Object.assign(content, newSchemaUsage)
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
	if (propertyRequiresFilenameMetadata(encoding, propertyEncoding)) {
		return true
	}
	return false	
}

function propertyRequiresFilenameMetadata(encoding: CodegenContentEncoding, propertyEncoding: CodegenContentPropertyEncoding): boolean {
	if (encoding.mediaType.mimeType === 'multipart/form-data' && propertyEncoding.contentType === 'application/octet-stream') {
		return true
	}
	return false
}

/**
 * Returns the default content type to use for a multipart part witht he given schema, using defaults
 * described in https://swagger.io/specification/#encoding-object
 */
function defaultContentType(schema: CodegenSchemaUsage): string {
	if (schema.type === 'string' && schema.format === 'binary') {
		return 'application/octet-stream'
	} else if (schema.type === 'object') {
		return 'application/json'
	} else if (schema.type === 'array' && schema.component) {
		return defaultContentType(schema.component)
	}
	return 'text/plain'
}
