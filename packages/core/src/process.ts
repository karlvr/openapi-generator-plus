import { OpenAPI, OpenAPIV2, OpenAPIV3 } from 'openapi-types'
import { CodegenDocument, CodegenOperation, CodegenResponse, CodegenState, CodegenProperty, CodegenParameter, CodegenMediaType, CodegenVendorExtensions, CodegenModel, CodegenAuthMethod, CodegenAuthScope, CodegenEnumValue, CodegenOperationGroup, CodegenServer, CodegenOperationGroups, CodegenNativeType, CodegenTypePurpose, CodegenArrayTypePurpose, CodegenMapTypePurpose, InvalidModelError, CodegenContent, CodegenParameterIn, CodegenTypes } from './types'
import { isOpenAPIV2ResponseObject, isOpenAPIReferenceObject, isOpenAPIV3ResponseObject, isOpenAPIV2GeneralParameterObject, isOpenAPIV2Document, isOpenAPIV3Operation } from './openapi-type-guards'
import { OpenAPIX } from './types/patches'
import * as _ from 'lodash'

function groupOperations(operationInfos: CodegenOperation[], state: CodegenState) {
	const strategy = state.generator.operationGroupingStrategy(state)

	const groups: CodegenOperationGroups = {}
	for (const operationInfo of operationInfos) {
		strategy(operationInfo, groups, state)
	}

	return _.values(groups)
}

function processCodegenDocument(doc: CodegenDocument) {
	/* Sort groups */
	doc.groups.sort((a, b) => a.name.localeCompare(b.name))
	for (const group of doc.groups) {
		processCodegenOperationGroup(group)
	}

	/* Sort models */
	doc.models.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
}

function processCodegenOperationGroup(group: CodegenOperationGroup) {
	group.operations.sort((a, b) => a.name.localeCompare(b.name))
}

function toCodegenParameter(parameter: OpenAPI.Parameter, parentName: string, state: CodegenState): CodegenParameter {
	parameter = resolveReference(parameter, state)

	let property: CodegenProperty | undefined
	if (parameter.schema) {
		/* We pass [] as parentName so we create any nested models at the root of the models package,
		 * as we reference all models relative to the models package, but a parameter is in an
		 * operation. TODO it would be nice to improve this; maybe we can declare an enum in an Api
		 * interface... we'd just need to make sure that the nativeTypes referring to it were fixed.
		 * But we don't know the Api class name at this point. If we knew it, we could perhaps pass
		 * the package along with the parent names in all cases. 
		 * However it's sort of up to the templates to decide where to output models... so does that
		 * mean that we need to provide more info to toNativeType so it can put in full package names?
		 */
		property = toCodegenProperty(parameter.name, parameter.schema, parameter.required || false, [], state)
	} else if (isOpenAPIV2GeneralParameterObject(parameter, state.specVersion)) {
		property = toCodegenProperty(parameter.name, parameter, parameter.required || false, [], state)
	} else {
		throw new Error(`Cannot resolve schema for parameter: ${JSON.stringify(parameter)}`)
	}

	if (property.models) {
		for (const model of property.models) {
			// TODO need to uniqueness check the model.name, and if we have to change it, then we need to change
			// the nativeType on the property, but that's a bit invasive... so we might need a better approach
			state.anonymousModels[model.name] = model
		}
	}

	const result: CodegenParameter = {
		name: parameter.name,
		type: property.type,
		nativeType: property.nativeType,
		in: parameter.in as CodegenParameterIn,
		description: parameter.description,
		required: parameter.required,
		collectionFormat: isOpenAPIV2GeneralParameterObject(parameter, state.specVersion) ? parameter.collectionFormat : undefined, // TODO OpenAPI3

		...extractCodegenTypes(property),
	}
	switch (parameter.in) {
		case 'query':
			result.isQueryParam = true
			break
		case 'path':
			result.isPathParam = true
			result.required = true
			break
		case 'header':
			result.isHeaderParam = true
			break
		case 'cookie':
			result.isCookieParam = true
			break
		case 'body':
			result.isBodyParam = true
			break
		case 'formData':
			result.isFormParam = true
			break
		default:
			throw new Error(`Unsupported parameter "in" value: ${parameter.in}`)
	}

	return result
}

/** Extract just the CodegenTypes from an object */
function extractCodegenTypes(object: CodegenTypes | undefined): CodegenTypes {
	return {
		isObject: object ? object.isObject : false,
		isArray: object ? object.isArray : false,
		isBoolean: object ? object.isBoolean : false,
		isNumber: object ? object.isNumber : false,
		isEnum: object ? object.isEnum : false,
		isDateTime: object ? object.isDateTime : false,
		isDate: object ? object.isDate : false,
		isTime: object ? object.isTime : false,
	}
}

interface IndexedObject {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[index: string]: any
}

function toCodegenVendorExtensions(ob: IndexedObject): CodegenVendorExtensions | undefined {
	const result: CodegenVendorExtensions = {}
	let found = false

	for (const name in ob) {
		if (name.startsWith('x-')) {
			result[name] = ob[name]
			found = true
		}
	}

	return found ? result : undefined
}

function toCodegenOperationName(path: string, method: string, operation: OpenAPI.Operation, state: CodegenState) {
	if (operation.operationId) {
		return operation.operationId
	}

	return state.generator.toOperationName(path, method, state)
}

function toCodegenOperation(path: string, method: string, operation: OpenAPI.Operation, state: CodegenState): CodegenOperation {
	const name = toCodegenOperationName(path, method, operation, state)
	const responses: CodegenResponse[] | undefined = toCodegenResponses(operation, name, state)
	const defaultResponse = responses ? responses.find(r => r.isDefault) : undefined

	let parameters: CodegenParameter[] | undefined
	if (operation.parameters) {
		parameters = []
		for (const parameter of operation.parameters) {
			parameters.push(toCodegenParameter(parameter, name, state))
		}
	}

	let consumes: CodegenMediaType[] | undefined

	if (isOpenAPIV3Operation(operation, state.specVersion)) {
		let requestBody = operation.requestBody
		requestBody = requestBody && resolveReference(requestBody, state)

		if (requestBody) {
			const requestBodyContents = toCodegenContentArray('request', requestBody.content, name, state)

			const requestBodyType = findCommonContentType(requestBodyContents)
			const requestBodyNativeType = findCommonContentNativeType(requestBodyContents)
			consumes = findAllContentMediaTypes(requestBodyContents)

			const requestBodyParameter: CodegenParameter = {
				name: 'body',
				in: 'body',

				type: requestBodyType,
				nativeType: requestBodyNativeType,

				description: requestBody.description,
				required: requestBody.required,

				isBodyParam: true,

				...extractCodegenTypes(requestBodyType && requestBodyContents ? requestBodyContents[0] : undefined),
			}

			if (!parameters) {
				parameters = []
			}
			parameters.push(requestBodyParameter)
		}
	} else {
		consumes = toConsumeMediaTypes(operation as OpenAPIV2.OperationObject, state)
	}

	let authMethods: CodegenAuthMethod[] | undefined
	if (operation.security) {
		authMethods = toCodegenAuthMethods(operation.security, state)
	}

	const op: CodegenOperation = {
		name,
		httpMethod: method,
		path,
		returnType: defaultResponse ? defaultResponse.type : undefined,
		returnNativeType: defaultResponse ? defaultResponse.nativeType : undefined,
		consumes,
		produces: responses ? toUniqueMediaTypes(responses.reduce((collected, response) => response.produces ? [...collected, ...response.produces] : collected, [] as CodegenMediaType[])) : undefined,
		
		allParams: parameters,
		queryParams: parameters?.filter(p => p.isQueryParam),
		pathParams: parameters?.filter(p => p.isPathParam),
		headerParams: parameters?.filter(p => p.isHeaderParam),
		cookieParams: parameters?.filter(p => p.isCookieParam),
		bodyParam: parameters?.find(p => p.isBodyParam),
		formParams: parameters?.filter(p => p.isFormParam),

		authMethods,
		defaultResponse,
		responses,
		isDeprecated: operation.deprecated,
		summary: operation.summary,
		description: operation.description,
		tags: operation.tags,
		vendorExtensions: toCodegenVendorExtensions(operation),
	}
	return op
}

function toUniqueMediaTypes(mediaTypes: CodegenMediaType[]): CodegenMediaType[] {
	return _.uniqWith(mediaTypes, mediaTypeEquals)
}

function mediaTypeEquals(a: CodegenMediaType, b: CodegenMediaType): boolean {
	return a.mediaType === b.mediaType
}

function toCodegenAuthMethods(security: OpenAPIV2.SecurityRequirementObject[] | OpenAPIV3.SecurityRequirementObject[], state: CodegenState): CodegenAuthMethod[] {
	const result: CodegenAuthMethod[] = []
	for (const securityElement of security) { /* Don't know why it's an array at the top level */
		for (const name in securityElement) {
			result.push(toCodegenAuthMethod(name, securityElement[name], state))
		}
	}
	return result
}

function toCodegenAuthMethod(name: string, scopes: string[] | undefined, state: CodegenState): CodegenAuthMethod {
	if (isOpenAPIV2Document(state.root)) {
		if (!state.root.securityDefinitions) {
			throw new Error('security requirement found but no security definitions found')
		}

		const scheme = state.root.securityDefinitions[name]
		switch (scheme.type) {
			case 'basic':
				return {
					type: scheme.type,
					description: scheme.description,
					name,
					isBasic: true,
					vendorExtensions: toCodegenVendorExtensions(scheme),
				}
			case 'apiKey': {
				const apiKeyIn: string | undefined = (scheme as any).in // FIXME once openapi-types releases https://github.com/kogosoftwarellc/open-api/commit/1121e63df3aa7bd3dc456825106a668505db0624
				return {
					type: scheme.type,
					description: scheme.description,
					name,
					paramName: (scheme as any).name, // FIXME once openapi-types releases https://github.com/kogosoftwarellc/open-api/commit/1121e63df3aa7bd3dc456825106a668505db0624
					in: apiKeyIn,
					isApiKey: true,
					isInHeader: apiKeyIn === 'header',
					isInQuery: apiKeyIn === 'query',
					vendorExtensions: toCodegenVendorExtensions(scheme),
				}
			}
			case 'oauth2':
				return {
					type: scheme.type,
					description: scheme.description,
					name,
					flow: scheme.flow,
					authorizationUrl: scheme.flow === 'implicit' || scheme.flow === 'accessCode' ? scheme.authorizationUrl : undefined,
					tokenUrl: scheme.flow === 'password' || scheme.flow === 'application' || scheme.flow === 'accessCode' ? scheme.tokenUrl : undefined,
					scopes: toCodegenAuthScopes(scopes, scheme.scopes, state),
					isOAuth: true,
					vendorExtensions: toCodegenVendorExtensions(scheme),
				}
		}
	} else {
		const schemes = state.root.components?.securitySchemes
		if (!schemes) {
			throw new Error('security requirement found but no security schemes found')
		}
		
		throw new Error('OpenAPIV3 document not yet supported for toAuthMethd')
	}
}

function toCodegenAuthScopes(scopeNames: string[] | undefined, scopes: OpenAPIV2.ScopesObject, state: CodegenState): CodegenAuthScope[] | undefined {
	if (!scopeNames) {
		return undefined
	}

	const vendorExtensions = toCodegenVendorExtensions(scopes)

	/* A bug in the swagger parser? The openapi-types don't suggest that scopes should be an array */
	if (Array.isArray(scopes)) {
		scopes = scopes[0]
	}

	const result: CodegenAuthScope[] = []
	for (const scopeName of scopeNames) {
		const scopeDescription = scopes[scopeName]
		result.push({
			scope: scopeName,
			description: scopeDescription,
			vendorExtensions,
		})
	}
	return result
}

/**
 * Resolve anything that may also be a ReferenceObject to the base type.
 * @param ob 
 * @param state 
 */
function resolveReference<T>(ob: T | OpenAPIV3.ReferenceObject | OpenAPIV2.ReferenceObject, state: CodegenState): T {
	if (isOpenAPIReferenceObject(ob)) {
		return state.parser.$refs.get(ob.$ref)
	} else {
		return ob
	}
}

function toConsumeMediaTypes(op: OpenAPIV2.OperationObject, state: CodegenState): CodegenMediaType[] | undefined {
	if (op.consumes) {
		return op.consumes?.map(mediaType => ({
			mediaType,
		}))
	} else {
		const doc = state.root as OpenAPIV2.Document
		if (doc.consumes) {
			return doc.consumes.map(mediaType => ({
				mediaType,
			}))
		} else {
			return undefined
		}
	}
}

function toProduceMediaTypes(op: OpenAPIV2.OperationObject, state: CodegenState): CodegenMediaType[] | undefined {
	if (op.produces) {
		return op.produces.map(mediaType => ({
			mediaType,
		}))
	} else {
		const doc = state.root as OpenAPIV2.Document
		if (doc.produces) {
			return doc.produces.map(mediaType => ({
				mediaType,
			}))
		} else {
			return undefined
		}
	}
}

function toCodegenResponses(operation: OpenAPI.Operation, parentName: string, state: CodegenState): CodegenResponse[] | undefined {
	const responses = operation.responses
	if (!responses) {
		return undefined
	}

	const result: CodegenResponse[] = []

	let bestCode: number | undefined
	let bestResponse: CodegenResponse | undefined

	for (const responseCodeString in responses) {
		const responseCode = responseCodeString === 'default' ? 0 : parseInt(responseCodeString, 10)
		const response = toCodegenResponse(operation, responseCode, responses[responseCodeString], false, parentName, state)

		result.push(response)

		/* See DefaultCodegen.findMethodResponse */
		if (responseCode === 0 || Math.floor(responseCode / 100) === 2) {
			if (bestCode === undefined || responseCode < bestCode) {
				bestCode = responseCode
				bestResponse = response
			}
		}
	}

	if (bestCode !== undefined && bestResponse) {
		bestResponse.isDefault = true
	}

	return result
}

/**
 * Convert a `$ref` into a name that could be turned into a type.
 * @param $ref 
 */
function nameFromRef($ref: string): string | undefined {
	const components = $ref.split('/')
	return components[components.length - 1]
}

function toCodegenResponse(operation: OpenAPI.Operation, code: number, response: OpenAPIX.Response, isDefault: boolean, parentName: string, state: CodegenState): CodegenResponse {
	response = resolveReference(response, state)

	if (code === 0) {
		code = 200
	}
	
	let contents: CodegenContent[] | undefined

	if (isOpenAPIV2ResponseObject(response, state.specVersion)) {
		const property = response.schema ? toCodegenProperty('response', response.schema, true, [parentName], state) : undefined
		
		const mediaTypes = toProduceMediaTypes(operation as OpenAPIV2.OperationObject, state)
		contents = mediaTypes ? mediaTypes.map(mediaType => {
			const result: CodegenContent = {
				mediaType,
				type: property ? property.type : undefined,
				nativeType: property ? property.nativeType : undefined,
				...extractCodegenTypes(property),
			}
			return result
		}) : undefined
	} else if (isOpenAPIV3ResponseObject(response, state.specVersion)) {
		contents = toCodegenContentArray('response', response.content, parentName, state)
	} else {
		throw new Error(`Unsupported response: ${JSON.stringify(response)}`)
	}

	/* Determine if there's a common type and nativeType */
	const type = findCommonContentType(contents)
	const nativeType = findCommonContentNativeType(contents)
	const produces = findAllContentMediaTypes(contents)

	return {
		code,
		description: response.description,
		isDefault,
		type,
		nativeType,
		contents,
		produces,
		vendorExtensions: toCodegenVendorExtensions(response),
	}
}

function findCommonContentType(contents: CodegenContent[] | undefined): string | undefined {
	if (!contents || !contents.length) {
		return undefined
	}

	return contents.reduce((existing, content) => (existing === content.type ? existing : undefined), contents[0].type)
}

function findCommonContentNativeType(contents: CodegenContent[] | undefined): CodegenNativeType | undefined {
	if (!contents || !contents.length) {
		return undefined
	}

	return contents.reduce((existing, content) => (existing && existing.equals(content.nativeType) ? existing : undefined), contents[0].nativeType)
}

function findAllContentMediaTypes(contents: CodegenContent[] | undefined): CodegenMediaType[] | undefined {
	if (!contents || !contents.length) {
		return undefined
	}

	return contents.reduce((existing, content) => content.mediaType ? [...existing, content.mediaType] : existing, [] as CodegenMediaType[])
}

function toCodegenContentArray(name: string, content: { [media: string]: OpenAPIV3.MediaTypeObject } | undefined, parentName: string, state: CodegenState): CodegenContent[] | undefined {
	if (!content) {
		return undefined
	}

	const result: CodegenContent[] = []
	for (const mediaType in content) {
		const mediaTypeContent = content[mediaType]

		const property = mediaTypeContent.schema ? toCodegenProperty(name, mediaTypeContent.schema, true, [parentName], state) : undefined
		
		const item: CodegenContent = {
			mediaType: { mediaType },
			type: property ? property.type : undefined,
			nativeType: property ? property.nativeType : undefined,
			...extractCodegenTypes(property),
		}
		result.push(item)
	}

	return result
}

function toCodegenProperty(name: string, schema: OpenAPIV2.Schema | OpenAPIV3.SchemaObject | OpenAPIV2.GeneralParameterObject, required: boolean, parentNames: string[], state: CodegenState): CodegenProperty {
	/* The name of the schema, which can be used to name custom types */
	let refName: string | undefined

	/* Grab the description before resolving refs, so we preserve the property description even if it references an object. */
	let description: string | undefined = (schema as OpenAPIV2.SchemaObject).description

	if (isOpenAPIReferenceObject(schema)) {
		refName = nameFromRef(schema.$ref)
	}

	schema = resolveReference(schema, state)

	let type: string
	let format: string | undefined
	let nativeType: CodegenNativeType
	let models: CodegenModel[] | undefined
	let isEnum = false

	if (!description) {
		description = schema.description
	}

	if (schema.enum) {
		isEnum = true
		if (!schema.type) {
			type = 'string'
		} else if (typeof schema.type === 'string') {
			type = schema.type
		} else {
			throw new Error(`Array value is unsupported for schema.type for enum: ${schema.type}`)
		}

		const enumName = state.generator.toEnumName(name, state)
		nativeType = state.generator.toNativeType({
			type: 'object',
			modelNames: refName ? [refName] : [...parentNames, enumName],
			purpose: CodegenTypePurpose.ENUM,
		}, state)
		if (!refName) {
			models = [toCodegenModel(enumName, parentNames, schema, state)]
		}
	} else if (schema.type === 'array') {
		if (!schema.items) {
			throw new Error('items missing for schema type "array"')
		}
		type = schema.type

		const componentProperty = toCodegenProperty(name, schema.items, true, refName ? [refName] : parentNames, state)
		nativeType = state.generator.toNativeArrayType({
			componentNativeType: componentProperty.nativeType,
			required,
			uniqueItems: schema.uniqueItems,
			modelNames: refName ? [refName] : undefined,
			purpose: CodegenArrayTypePurpose.PROPERTY,
		}, state)
		models = componentProperty.models
	} else if (schema.type === 'object') {
		type = schema.type

		if (schema.additionalProperties) {
			/* Map
			 * See https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#model-with-mapdictionary-properties
			 */
			const keyNativeType = state.generator.toNativeType({
				type: 'string',
				purpose: CodegenTypePurpose.KEY,
			}, state)
			const componentProperty = toCodegenProperty(name, schema.additionalProperties, false, refName ? [refName] : parentNames, state)

			nativeType = state.generator.toNativeMapType({
				keyNativeType,
				componentNativeType: componentProperty.nativeType,
				modelNames: refName ? [refName] : undefined,
				purpose: CodegenMapTypePurpose.PROPERTY,
			}, state)
			models = componentProperty.models
		} else {
			const modelNameForPropertyName = state.generator.toModelNameFromPropertyName(name, state)
			nativeType = state.generator.toNativeType({
				type,
				format: schema.format,
				required,
				modelNames: refName ? [refName] : [...parentNames, modelNameForPropertyName],
				purpose: CodegenTypePurpose.PROPERTY,
			}, state)
			if (!refName) {
				models = [toCodegenModel(modelNameForPropertyName, refName ? [refName] : parentNames, schema, state)]
			}
		}
	} else if (schema.allOf || schema.anyOf || schema.oneOf) {
		type = 'object'

		const modelNameForPropertyName = state.generator.toModelNameFromPropertyName(name, state)
		nativeType = state.generator.toNativeType({
			type,
			format: schema.format,
			required,
			modelNames: refName ? [refName] : [...parentNames, modelNameForPropertyName],
			purpose: CodegenTypePurpose.PROPERTY,
		}, state)
		if (!refName) {
			models = [toCodegenModel(modelNameForPropertyName, refName ? [refName] : parentNames, schema, state)]
		}
	} else if (typeof schema.type === 'string') {
		type = schema.type
		format = schema.format
		nativeType = state.generator.toNativeType({
			type,
			format,
			required,
			purpose: CodegenTypePurpose.PROPERTY,
		}, state)
	} else {
		throw new Error(`Unsupported schema type "${schema.type}" for property in ${JSON.stringify(schema)}`)
	}

	return {
		name,
		description,
		title: schema.title,
		defaultValue: state.generator.toDefaultValue(schema.default, { type, format: schema.format, required }, state),
		readOnly: !!schema.readOnly,
		required,
		vendorExtensions: toCodegenVendorExtensions(schema),

		type,
		nativeType,

		/* Validation */
		maximum: schema.maximum,
		exclusiveMaximum: schema.exclusiveMaximum,
		minimum: schema.minimum,
		exclusiveMinimum: schema.exclusiveMinimum,
		maxLength: schema.maxLength,
		minLength: schema.minLength,
		pattern: schema.pattern,
		maxItems: schema.maxItems,
		minItems: schema.minLength,
		uniqueItems: schema.uniqueItems,
		multipleOf: schema.multipleOf,

		...toCodegenTypes(type, format, isEnum),

		models,
	}
}

function toCodegenTypes(type: string, format: string | undefined, isEnum: boolean): CodegenTypes {
	return {
		isObject: type === 'object',
		isArray: type === 'array',
		isBoolean: type === 'boolean',
		isNumber: type === 'number' || type === 'integer',
		isEnum,
		isDateTime: type === 'string' && format === 'date-time',
		isDate: type === 'string' && format === 'date',
		isTime: type === 'string' && format === 'time',
	}
}

function toCodegenModel(name: string, parentNames: string[] | undefined, schema: OpenAPIV2.SchemaObject | OpenAPIV2.GeneralParameterObject | OpenAPIV3.SchemaObject, state: CodegenState): CodegenModel {
	if (isOpenAPIReferenceObject(schema)) {
		const refName = nameFromRef(schema.$ref)
		if (refName) {
			/* We are nested, but we're a ref to a top-level model */
			name = refName
			parentNames = undefined
		}
	}
	schema = resolveReference(schema, state)
	
	const vars: CodegenProperty[] = []
	const models: CodegenModel[] = []

	const nestedParentNames = parentNames ? [...parentNames, name] : [name]

	if (typeof schema.properties === 'object') {
		for (const propertyName in schema.properties) {
			const required = typeof schema.required === 'object' ? schema.required.indexOf(propertyName) !== -1 : false
			const propertySchema = schema.properties[propertyName]
			const property = toCodegenProperty(propertyName, propertySchema, required, nestedParentNames, state)
			vars.push(property)

			if (property.models) {
				models.push(...property.models)
			}
		}
	}

	let enumValueNativeType: CodegenNativeType | undefined
	let enumValues: CodegenEnumValue[] | undefined
	let parent: CodegenNativeType | undefined

	if (schema.allOf) {
		for (const subSchema of schema.allOf) {
			/* We don't actually care about the model name, as we just use the vars */
			const subModel = toCodegenModel(name, nestedParentNames, subSchema, state)
			vars.push(...subModel.vars)
		}
	} else if (schema.anyOf) {
		throw new Error('anyOf not supported')
	} else if (schema.oneOf) {
		throw new Error('oneOf not supported')
	} else if (schema.enum) {
		let type: string
		if (!schema.type) {
			type = 'string'
		} else if (typeof schema.type === 'string') {
			type = schema.type
		} else {
			throw new Error(`Array value is unsupported for schema.type for enum: ${schema.type}`)
		}

		const enumValueType = type
		const enumValueFormat = schema.format

		enumValueNativeType = state.generator.toNativeType({
			type,
			format: schema.format,
			purpose: CodegenTypePurpose.ENUM,
		}, state)
		enumValues = schema.enum ? schema.enum.map(value => ({
			value,
			literalValue: state.generator.toLiteral(value, { type: enumValueType, format: enumValueFormat }, state),
		})) : undefined
	} else if (schema.type === 'array') {
		if (!schema.items) {
			throw new Error('items missing for schema type "array"')
		}

		const componentProperty = toCodegenProperty(name, schema.items, true, [], state)
		parent = state.generator.toNativeArrayType({
			componentNativeType: componentProperty.nativeType,
			uniqueItems: schema.uniqueItems,
			purpose: CodegenArrayTypePurpose.PARENT,
		}, state)
	} else if (schema.type === 'object') {
		/* Nothing to do */
		if (schema.additionalProperties) {
			const keyNativeType = state.generator.toNativeType({
				type: 'string',
				purpose: CodegenTypePurpose.KEY,
			}, state)
			const componentProperty = toCodegenProperty(name, schema.additionalProperties, false, [], state)

			parent = state.generator.toNativeMapType({
				keyNativeType,
				componentNativeType: componentProperty.nativeType,
				purpose: CodegenMapTypePurpose.PARENT,
			}, state)
		}
	} else {
		throw new Error(`Unsupported schema type "${schema.type}" for model "${name}": ${JSON.stringify(schema)}`)
	}

	return {
		name,
		description: schema.description,
		vars,
		vendorExtensions: toCodegenVendorExtensions(schema),
		models: models.length ? models : undefined,
		isEnum: enumValues !== undefined,
		enumValueNativeType,
		enumValues,
		parent,
	}
}

const enum HttpMethods {
	DELETE = 'DELETE',
	GET = 'GET',
	HEAD = 'HEAD',
	OPTIONS = 'OPTIONS',
	PATCH = 'PATCH',
	POST = 'POST',
	PUT = 'PUT',
}

function toCodegenServers(root: OpenAPI.Document): CodegenServer[] | undefined {
	if (isOpenAPIV2Document(root)) {
		if (root.schemes && root.host) {
			return root.schemes.map(scheme => ({
				url: `${scheme}://${root.host}${root.basePath ? root.basePath : '/'}`,
			}))
		} else {
			return undefined
		}
	} else {
		return root.servers
	}
}

export function processDocument(state: CodegenState) {
	const operations: CodegenOperation[] = []

	function createCodegenOperation(path: string, method: string, operation: OpenAPI.Operation | undefined) {
		if (!operation) {
			return
		}
	
		const op = toCodegenOperation(path, method, operation, state)
		operations.push(op)
	}

	const root = state.root

	for (const path in root.paths) {
		const pathItem: OpenAPIV2.PathItemObject | OpenAPIV3.PathItemObject = root.paths[path]

		createCodegenOperation(path, HttpMethods.DELETE, pathItem.delete)
		createCodegenOperation(path, HttpMethods.GET, pathItem.get)
		createCodegenOperation(path, HttpMethods.HEAD, pathItem.head)
		createCodegenOperation(path, HttpMethods.OPTIONS, pathItem.options)
		createCodegenOperation(path, HttpMethods.PATCH, pathItem.patch)
		createCodegenOperation(path, HttpMethods.POST, pathItem.post)
		createCodegenOperation(path, HttpMethods.PUT, pathItem.put)
	}

	const doc: CodegenDocument = {
		info: root.info,
		groups: [],
		models: [],
		servers: toCodegenServers(root),
	}
	doc.groups = groupOperations(operations, state)

	const models = isOpenAPIV2Document(root) ? root.definitions : root.components?.schemas
	if (models) {
		for (const schemaName in models) {
			try {
				const model = toCodegenModel(schemaName, undefined, models[schemaName], state)
				doc.models.push(model)
			} catch (error) {
				if (error instanceof InvalidModelError || error.name === 'InvalidModelError') {
					/* Ignoring invalid model. We don't need to generate invalid models, they are not intended to be generated */
				} else {
					throw error
				}
			}
		}
	}

	/* Add anonymous models to our document's models */
	for (const modelName in state.anonymousModels) {
		const model = state.anonymousModels[modelName]
		doc.models.push(model)
	}

	processCodegenDocument(doc)
	return doc
}
