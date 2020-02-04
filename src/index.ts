import SwaggerParser from 'swagger-parser'
import { OpenAPI, OpenAPIV2, OpenAPIV3 } from 'openapi-types'
import Handlebars, { HelperOptions } from 'handlebars'
import { promises as fs } from 'fs'
import path from 'path'
import { constantCase } from 'change-case'
import { CodegenDocument, CodegenConfig, CodegenOperation, CodegenResponse, CodegenState, CodegenProperty, CodegenParameter, CodegenMediaType, CodegenVendorExtensions, CodegenModel, CodegenOptionsJava, CodegenRootContext, CodegenRootContextJava, CodegenInitialOptions, CodegenAuthMethod, CodegenAuthScope } from './types'
import { isOpenAPIV2ResponseObject, isOpenAPIVReferenceObject, isOpenAPIV3ResponseObject, isOpenAPIV2GeneralParameterObject, isOpenAPIV2Operation, isOpenAPIV2Document } from './openapi-type-guards'
import { OpenAPIX } from './types/patches'
import getopts from 'getopts'
import { pascalCase, camelCase, capitalize } from './case-transforms'


/** Returns the string converted to a string that is safe as an identifier in most languages */
function identifierSafe(value: string) {
	/* Remove invalid leading characters */
	value = value.replace(/^[^a-zA-Z_]*/, '')

	/* Convert any illegal characters to underscores */
	value = value.replace(/[^a-zA-Z0-9_]/g, '_')

	return value
}

/**
 * Camel case and capitalize suitable for a class name. Doesn't change existing
 * capitalization in the value.
 * e.g. "FAQSection" remains "FAQSection", and "faqSection" will become "FaqSection" 
 * @param value string to be turned into a class name
 */
function classCamelCase(value: string) {
	return pascalCase(identifierSafe(value))
}

function identifierCamelCase(value: string) {
	return camelCase(identifierSafe(value))
}

function escapeString(value: string) {
	value = value.replace(/\\/g, '\\\\')
	value = value.replace(/"/g, '\\"')
	return value
}

const JavaCodegenConfig: CodegenConfig = {
	toClassName: (name) => {
		return classCamelCase(name)
	},
	toIdentifier: (name) => {
		return identifierCamelCase(name)
	},
	toConstantName: (name) => {
		return constantCase(name)
	},
	toEnumName: (name) => {
		return classCamelCase(name) + 'Enum'
	},
	toOperationName: (path, method) => {
		return `${method.toLocaleLowerCase()}_${path}`
	},
	toLiteral: (value, type, format, required) => {
		if (value === undefined) {
			return undefined
		}

		switch (type) {
			case 'integer': {
				if (format === 'int32' || format === undefined) {
					return !required ? `java.lang.Integer.valueOf(${value})` : `${value}`
				} else if (format === 'int64') {
					return !required ? `java.lang.Long.valueOf(${value})` : `${value}L`
				} else {
					throw new Error(`Unsupported ${type} format: ${format}`)
				}
			}
			case 'number': {
				if (format === 'float') {
					return !required ? `java.lang.Float.valueOf(${value}f)` : `${value}f`
				} else if (format === 'double') {
					return !required ? `java.lang.Double.valueOf(${value}d)` : `${value}d`
				} else {
					throw new Error(`Unsupported ${type} format: ${format}`)
				}
			}
			case 'string': {
				if (format === 'byte') {
					return !required ? `java.lang.Byte.valueOf(${value}b)` : `${value}b`
				} else if (format === 'binary') {
					throw new Error(`Cannot format literal for type ${type} format ${format}`)
				} else if (format === 'date') {
					return `java.time.LocalDate.parse("${value}")`
				} else if (format === 'date-time') {
					return `java.time.ZonedDateTime.parse("${value}")`
				} else {
					return `"${escapeString(value)}"`
				}
			}
			case 'boolean':
				return !required ? `java.lang.Boolean.valueOf(${value})` : `${value}`
			case 'object':
			case 'file':
				throw new Error(`Cannot format literal for type ${type}`)
		}

		throw new Error(`Unsupported type name: ${type}`)
	},
	toNativeType: (type, format, required, modelNames, state) => {
		if (type === 'object' && modelNames) {
			let modelName = `${(state.options as CodegenOptionsJava).modelPackage}`
			for (const name of modelNames) {
				modelName += `.${state.config.toClassName(name, state)}`
			}
			return modelName
		}

		/* See https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#data-types */
		switch (type) {
			case 'integer': {
				if (format === 'int32' || format === undefined) {
					return !required ? 'java.lang.Integer' : 'int'
				} else if (format === 'int64') {
					return !required ? 'java.lang.Long' : 'long'
				} else {
					throw new Error(`Unsupported ${type} format: ${format}`)
				}
			}
			case 'number': {
				if (format === 'float' || format === undefined) {
					return !required ? 'java.lang.Float' : 'float'
				} else if (format === 'double') {
					return !required ? 'java.lang.Double' : 'double'
				} else {
					throw new Error(`Unsupported ${type} format: ${format}`)
				}
			}
			case 'string': {
				if (format === 'byte') {
					return !required ? 'java.lang.Byte' : 'byte'
				} else if (format === 'binary') {
					return 'java.lang.Object'
				} else if (format === 'date') {
					return 'java.time.LocalDate'
				} else if (format === 'date-time') {
					return 'java.time.ZonedDateTime'
				} else {
					return 'java.lang.String'
				}
			}
			case 'boolean': {
				return !required ? 'java.lang.Boolean' : 'boolean'
			}
			case 'object': {
				return 'java.lang.Object'
			}
			case 'file': {
				return 'java.io.InputStream'
			}
		}

		throw new Error(`Unsupported type name: ${type}`)
	},
	toNativeArrayType: (componentNativeType, uniqueItems) => {
		if (uniqueItems) {
			return `java.util.Set<${componentNativeType}>`
		} else {
			return `java.util.List<${componentNativeType}>`
		}
	},
	toNativeMapType: (keyNativeType, componentNativeType) => {
		return `java.util.Map<${keyNativeType}, ${componentNativeType}>`
	},
	toDefaultValue: (defaultValue, type, format, required, state) => {
		if (defaultValue !== undefined) {
			return `${defaultValue}`
		}

		if (!required) {
			return 'null'
		}

		switch (type) {
			case 'integer':
			case 'number':
				return state.config.toLiteral(0, type, format, required, state)
			case 'boolean':
				return 'false'
			case 'string':
			case 'object':
			case 'array':
			case 'file':
				return 'null'
		}

		throw new Error(`Unsupported type name: ${type}`)
	},
	options: (initialOptions): CodegenOptionsJava => {
		const packageName = initialOptions.package || 'com.example'
		return {
			hideGenerationTimestamp: true,
			apiPackage: `${packageName}`,
			apiServiceImplPackage: `${packageName}.impl`,
			modelPackage: `${packageName}.model`,
			invokerPackage: `${packageName}.app`,
			useBeanValidation: true,
			...initialOptions,
		}
	},
}

// TODO this represents a strategy for grouping operations
/**
 * See JavaJAXRSSpecServerCodegen.addOperationToGroup
 * @param operationInfo 
 * @param apiInfo 
 */
function addOperationToGroup(operationInfo: CodegenOperation, apiInfo: CodegenDocument) {
	let basePath = operationInfo.path
	
	const pos = basePath.indexOf('/', 1)
	if (pos > 0) {
		basePath = basePath.substring(0, pos)
	}
	if (basePath === '' || basePath === '/') {
		basePath = 'default'
	} else {
		/* Convert operation path to be relative to basePath */
		operationInfo = { ...operationInfo }
		operationInfo.path = operationInfo.path.substring(basePath.length)
	}

	let groupName = basePath
	if (groupName.startsWith('/')) {
		groupName = groupName.substring(1)
	}

	if (!apiInfo.groups[groupName]) {
		apiInfo.groups[groupName] = {
			name: groupName,
			path: basePath,
			operations: {
				operation: [],
			},
			consumes: [], // TODO in OpenAPIV2 these are on the document, but not on OpenAPIV3
			produces: [], // TODO in OpenAPIV2 these are on the document, but not on OpenAPIV3
		}
	}
	apiInfo.groups[groupName].operations.operation.push(operationInfo)
}

function addOperationsToGroups(operationInfos: CodegenOperation[], apiInfo: CodegenDocument) {
	for (const operationInfo of operationInfos) {
		addOperationToGroup(operationInfo, apiInfo)
	}
}

function processCodegenDocument(doc: CodegenDocument) {
	for (const name in doc.groups) {
		doc.groups[name].operations.operation.sort((a, b) => a.name.localeCompare(b.name))
	}
}

async function compileTemplate(templatePath: string) {
	const templateSource = await fs.readFile(templatePath, 'UTF-8')
	return Handlebars.compile(templateSource)
}

async function loadTemplates(templateDirPath: string) {
	const files = await fs.readdir(templateDirPath)
	for (const file of files) {
		const template = await compileTemplate(path.resolve(templateDirPath, file))
		Handlebars.registerPartial(path.parse(file).name, template)
	}
}

async function emit(templateName: string, outputPath: string, context: object, replace: boolean) {
	const template = Handlebars.partials[templateName]
	if (!template) {
		throw new Error(`Unknown template: ${templateName}`)
	}
	const outputString = template(context)

	if (outputPath === '-') {
		console.log(outputString)
	} else {
		if (!replace) {
			try {
				await fs.access(outputPath)
				/* File exists, don't replace */
				return
			} catch (error) {
				/* Ignore, file doesn't exist */
			}
		}
		await fs.mkdir(path.dirname(outputPath), { recursive: true })
		fs.writeFile(outputPath, outputString, 'UTF-8')
	}
}

function createCodegenOperation(path: string, method: string, operation: OpenAPI.Operation | undefined, result: CodegenOperation[], state: CodegenState) {
	if (!operation) {
		return
	}

	const op = toCodegenOperation(path, method, operation, state)
	result.push(op)
}

function toCodegenParameter(parameter: OpenAPI.Parameter, parentName: string, state: CodegenState): CodegenParameter {
	parameter = resolveReference(parameter, state)

	let property: CodegenProperty | undefined
	if (parameter.schema) {
		/* We pass [] as parentName so we create any nested models at the room of the models package,
		 * as we reference all models relative to the models package, but a parameter is in an
		 * operation. TODO it would be nice to improve this; maybe we can declare an enum in an Api
		 * interface... we'd just need to make sure that the nativeTypes referring to it were fixed.
		 * But we don't know the Api class name at this point. If we knew it, we could perhaps pass
		 * the package along with the parent names in all cases. 
		 * However it's sort of up to the templates to decide where to output models... so does that
		 * mean that we need to provide more info to toNativeType so it can put in full package names?
		 */
		property = toCodegenProperty(parameter.name, parameter.schema, parameter.required || false, [], state)
	} else if (isOpenAPIV2GeneralParameterObject(parameter)) {
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
		in: parameter.in,
		description: parameter.description,
		required: parameter.required,
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
	}

	return result
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

	return state.config.toOperationName(path, method, state)
}

function toCodegenOperation(path: string, method: string, operation: OpenAPI.Operation, state: CodegenState): CodegenOperation {
	const name = toCodegenOperationName(path, method, operation, state)
	const responses: CodegenResponse[] | undefined = operation.responses ? toCodegenResponses(operation.responses, name, state) : undefined
	const defaultResponse = responses ? responses.find(r => r.isDefault) : undefined

	let parameters: CodegenParameter[] | undefined
	if (operation.parameters) {
		parameters = []
		for (const parameter of operation.parameters) {
			parameters.push(toCodegenParameter(parameter, name, state))
		}
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
		consumes: toConsumeMediaTypes(operation, state),
		produces: toProduceMediaTypes(operation, state),
		allParams: parameters,
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
			case 'apiKey':
				return {
					type: scheme.type,
					description: scheme.description,
					name,
					paramName: scheme.name,
					in: scheme.in,
					isApiKey: true,
					vendorExtensions: toCodegenVendorExtensions(scheme),
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

function toConsumeMediaTypes(op: OpenAPI.Operation, state: CodegenState): CodegenMediaType[] | undefined {
	if (isOpenAPIV2Operation(op)) {
		return op.consumes?.map(mediaType => ({
			mediaType,
		}))
	} else if (op.requestBody) {
		const requestBody = resolveReference(op.requestBody, state)
		return toCodegenMediaTypes(requestBody.content)
	} else {
		return undefined
	}
}

/**
 * Resolve anything that may also be a ReferenceObject to the base type.
 * @param ob 
 * @param state 
 */
function resolveReference<T>(ob: T | OpenAPIV3.ReferenceObject | OpenAPIV2.ReferenceObject, state: CodegenState): T {
	if (isOpenAPIVReferenceObject(ob)) {
		return state.parser.$refs.get(ob.$ref)
	} else {
		return ob
	}
}

function toProduceMediaTypes(op: OpenAPI.Operation, state: CodegenState): CodegenMediaType[] | undefined {
	if (isOpenAPIV2Operation(op)) {
		return op.produces?.map(mediaType => ({
			mediaType,
		}))
	} else if (op.responses) {
		const defaultResponse = toCodegenResponses(op.responses, '', state).find(r => r.isDefault)
		if (defaultResponse) {
			let response = op.responses[defaultResponse.code]
			if (response) {
				response = resolveReference(response, state)
				if (response.content) {
					return toCodegenMediaTypes(response.content)
				}
			}
		}
		return undefined
	} else {
		return undefined
	}
}

function toCodegenMediaTypes(content: { [media: string]: OpenAPIV3.MediaTypeObject }) {
	const result: CodegenMediaType[] = []
	for (const mediaType in content) {
		result.push({
			mediaType,
		})
	}
	return result
}

function processCodegenOperations(operationInfos: CodegenOperation[], state: CodegenState) {
	for (const operationInfo of operationInfos) {
		processOperationInfo(operationInfo, state)
	}
}

function processOperationInfo(op: CodegenOperation, state: CodegenState) {
	// TODO
}

function toCodegenResponses(responses: OpenAPIX.ResponsesObject, parentName: string, state: CodegenState): CodegenResponse[] {
	const result: CodegenResponse[] = []

	let bestCode: number | undefined
	let bestResponse: CodegenResponse | undefined

	for (const responseCodeString in responses) {
		const responseCode = responseCodeString === 'default' ? 0 : parseInt(responseCodeString, 10)
		const response = toCodegenResponse(responseCode, responses[responseCodeString], false, parentName, state)

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
	if ($ref.startsWith('#/definitions/')) {
		return $ref.substring('#/definitions/'.length)
	}
	return undefined
}

function toCodegenResponse(code: number, response: OpenAPIX.Response, isDefault: boolean, parentName: string, state: CodegenState): CodegenResponse {
	response = resolveReference(response, state)

	if (code === 0) {
		code = 200
	}
	
	if (isOpenAPIV2ResponseObject(response)) {
		const property = response.schema ? toCodegenProperty('response', response.schema, true, [parentName], state) : undefined
		
		return {
			code,
			description: response.description,
			isDefault,
			type: property ? property.type : undefined,
			nativeType: property ? property.nativeType : undefined,
			vendorExtensions: toCodegenVendorExtensions(response),
		}
	} else if (isOpenAPIV3ResponseObject(response)) {
		return {
			code,
			description: response.description,
			isDefault,
			vendorExtensions: toCodegenVendorExtensions(response),
		}
	} else {
		throw new Error(`Unsupported response: ${JSON.stringify(response)}`)
	}
}

function toCodegenProperty(name: string, schema: OpenAPIV2.Schema | OpenAPIV3.SchemaObject | OpenAPIV2.GeneralParameterObject, required: boolean, parentNames: string[], state: CodegenState): CodegenProperty {
	/* The name of the schema, which can be used to name custom types */
	let refName: string | undefined
	if (isOpenAPIVReferenceObject(schema)) {
		refName = nameFromRef(schema.$ref)
	}

	schema = resolveReference(schema, state)

	let type: string
	let nativeType: string
	let models: CodegenModel[] | undefined

	if (schema.enum) {
		if (!schema.type) {
			type = 'string'
		} else if (typeof schema.type === 'string') {
			type = schema.type
		} else {
			throw new Error(`Array value is unsupported for schema.type for enum: ${schema.type}`)
		}

		const enumName = state.config.toEnumName(name, state)
		nativeType = state.config.toNativeType('object', undefined, false, refName ? [refName] : [...parentNames, enumName], state)
		if (!refName) {
			models = [toCodegenModel(enumName, parentNames, schema, state)]
		}
	} else if (schema.type === 'array') {
		if (!schema.items) {
			throw new Error('items missing for schema type "array"')
		}
		type = schema.type

		// TODO maybe need to de-pluralize the property name in order to use it to make an anonymous model name
		// for the array components (if schema.items isn't a reference)
		const componentProperty = toCodegenProperty(name, schema.items, false, refName ? [refName] : parentNames, state)
		nativeType = state.config.toNativeArrayType(componentProperty.nativeType, schema.uniqueItems, state)
		models = componentProperty.models
	} else if (schema.type === 'object') {
		type = schema.type

		if (schema.additionalProperties) {
			/* Map
			 * See https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#model-with-mapdictionary-properties
			 */
			const keyNativeType = state.config.toNativeType('string', undefined, true, undefined, state)
			const componentProperty = toCodegenProperty(name, schema.additionalProperties, false, refName ? [refName] : parentNames, state)

			nativeType = state.config.toNativeMapType(keyNativeType, componentProperty.nativeType, state)
			models = componentProperty.models
		} else {
			nativeType = state.config.toNativeType(type, schema.format, required, refName ? [refName] : [...parentNames, name], state)
			if (!refName) {
				models = [toCodegenModel(name, refName ? [refName] : parentNames, schema, state)]
			}
		}
	} else if (schema.allOf || schema.anyOf || schema.oneOf) {
		type = 'object'
		nativeType = state.config.toNativeType(type, schema.format, required, refName ? [refName] : [...parentNames, name], state)
		if (!refName) {
			models = [toCodegenModel(name, refName ? [refName] : parentNames, schema, state)]
		}
	} else if (typeof schema.type === 'string') {
		type = schema.type
		nativeType = state.config.toNativeType(type, schema.format, required, undefined, state)
	} else {
		throw new Error(`Unsupported schema type "${schema.type}" for property in ${JSON.stringify(schema)}`)
	}

	return {
		name,
		description: schema.description,
		title: schema.title,
		defaultValue: state.config.toDefaultValue(schema.default, type, schema.format, required, state),
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

		isObject: type === 'object',
		isArray: type === 'array',
		isBoolean: type === 'boolean',
		isNumber: type === 'number' || type === 'integer',
		isEnum: !!schema.enum,

		models,
	}
}

function toCodegenModel(name: string, parentNames: string[] | undefined, schema: OpenAPIV2.SchemaObject | OpenAPIV2.GeneralParameterObject | OpenAPIV3.SchemaObject, state: CodegenState): CodegenModel {
	if (isOpenAPIVReferenceObject(schema)) {
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

	let enumValueNativeType: string | undefined
	let enumValues: any

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

		enumValueNativeType = state.config.toNativeType(type, schema.format, false, undefined, state)
		enumValues = schema.enum ? schema.enum.map(value => state.config.toLiteral(value, enumValueType, enumValueFormat, false, state)) : undefined
	} else if (schema.type === 'object') {
		/* Nothing to do */
	} else {
		throw new Error(`Unsupported schema type "${schema.type}" for model in ${JSON.stringify(schema)}`)
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function prepareApiContext(context: any, state: CodegenState, root?: CodegenRootContext): any {
	return {
		...context,
		...state.options,
		...root,
		// classname: config.toApiName(context.name),
	}
}

async function loadCommandLineConfig(path: string): Promise<CodegenInitialOptions> {
	const configJSON = await fs.readFile(path, {
		encoding: 'UTF-8',
	}) as string
	return JSON.parse(configJSON)
}

function usage() {
	console.log(`usage: ${process.argv[1]} [-c <config json>] -o <output dir> -t <template module or path> <path or url to api spec>`)
}

export async function run() {
	try {
		const commandLineOptions = getopts(process.argv.slice(2), {
			alias: {
				config: 'c',
				output: 'o',
				template: 't',
			},
			unknown: (option) => {
				console.log(`Unknown option: ${option}`)
				return false
			},
		})

		if (commandLineOptions._.length === 0 || !commandLineOptions.output || !commandLineOptions.template) {
			usage()
			process.exit(1)
		}

		const initialOptions = commandLineOptions.config ? await loadCommandLineConfig(commandLineOptions.config) : {}

		const parser = new SwaggerParser()
		const root = await parser.parse(commandLineOptions._[0])
		const config: CodegenConfig = JavaCodegenConfig

		const state: CodegenState = {
			parser,
			root,
			config,
			options: config.options(initialOptions),
			anonymousModels: {},
		}

		// console.log('refs', parser.$refs)
		// return
		
		// console.log(JSON.stringify(api, null, 2))

		const operations: CodegenOperation[] = []

		for (const path in root.paths) {
			const pathItem: OpenAPIV2.PathItemObject | OpenAPIV3.PathItemObject = root.paths[path]

			createCodegenOperation(path, HttpMethods.DELETE, pathItem.delete, operations, state)
			createCodegenOperation(path, HttpMethods.GET, pathItem.get, operations, state)
			createCodegenOperation(path, HttpMethods.HEAD, pathItem.head, operations, state)
			createCodegenOperation(path, HttpMethods.OPTIONS, pathItem.options, operations, state)
			createCodegenOperation(path, HttpMethods.PATCH, pathItem.patch, operations, state)
			createCodegenOperation(path, HttpMethods.POST, pathItem.post, operations, state)
			createCodegenOperation(path, HttpMethods.PUT, pathItem.put, operations, state)
		}

		// console.log(operationInfos)

		processCodegenOperations(operations, state)

		const doc: CodegenDocument = {
			groups: {},
			schemas: {},
		}
		addOperationsToGroups(operations, doc)

		if (isOpenAPIV2Document(root)) {
			if (root.definitions) {
				for (const schemaName in root.definitions) {
					const model = toCodegenModel(schemaName, undefined, root.definitions[schemaName], state)
					doc.schemas[schemaName] = model
				}
			}
		} else {
			// TODO
		}

		processCodegenDocument(doc)

		/** Convert the string argument to a Java class name. */
		Handlebars.registerHelper('className', function(name: string) {
			if (typeof name === 'string') {
				return config.toClassName(name, state)
			} else {
				throw new Error(`className helper has invalid name parameter: ${name}`)
			}
		})
		/** Convert the given name to be a safe appropriately named identifier for the language */
		Handlebars.registerHelper('identifier', function(name: string) {
			if (typeof name === 'string') {
				return config.toIdentifier(name, state)
			} else {
				throw new Error(`identifier helper has invalid parameter: ${name}`)
			}
		})
		Handlebars.registerHelper('constantName', function(name: string) {
			if (typeof name === 'string') {
				return config.toConstantName(name, state)
			} else {
				throw new Error(`constantName helper has invalid parameter: ${name}`)
			}
		})
		// Handlebars.registerHelper('literal', function(value: any) {
		// 	if (value !== undefined) {
		// 		return new Handlebars.SafeString(config.toLiteral(value, state))
		// 	} else {
		// 		throw new Error(`literal helper has invalid parameter: ${value}`)
		// 	}
		// })
		Handlebars.registerHelper('capitalize', function(value: string) {
			return capitalize(value)
		})
		Handlebars.registerHelper('escapeString', function(value: string) {
			return escapeString(value)
		})
		// Handlebars.registerHelper('hasConsumes', function(this: any, options: HelperOptions) {
		// 	if (this.consumes) {
		// 		return options.fn({
		// 			...this,
		// 			consumes: this.consumes.map((mediaType: string) => ({ mediaType })),
		// 		})
		// 	} else {
		// 		return options.inverse(this)
		// 	}
		// })
		// Handlebars.registerHelper('hasProduces', function(this: any, options: HelperOptions) {
		// 	if (this.produces) {
		// 		return options.fn({
		// 			...this,
		// 			produces: this.produces.map((mediaType: string) => ({ mediaType })),
		// 		})
		// 	} else {
		// 		return options.inverse(this)
		// 	}
		// })
		// Handlebars.registerHelper('subresourceOperation', function(this: any, options: HelperOptions) {
		// 	if (this.path) {
		// 		return options.fn(this)
		// 	} else {
		// 		return options.inverse(this)
		// 	}
		// })
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		Handlebars.registerHelper('hasMore', function(this: any, options: HelperOptions) {
			if (options.data.last === false) {
				return options.fn(this)
			} else {
				return options.inverse(this)
			}
		})
		// Handlebars.registerHelper('dataType', function(this: any, name: string) {
		// 	/* Convert the given swagger type to a type appropriate to the language */
		// 	if (this.type) {
		// 		return new Handlebars.SafeString(config.toDataType(this.type, this.format, this.required, this.refName))
		// 	}
		// })
		// Handlebars.registerHelper('returnBaseType', function(this: CodegenOperationDetail, options: HelperOptions) {
		// 	// console.log('returnBaseType', options)
		// 	if (this.responses) {

		// 	}
		// 	if (options.fn) {
		// 		/* Block helper */
		// 		return options.fn(this)
		// 	} else {
		// 		return 'OK'
		// 	}
		// })
		// Handlebars.registerHelper('httpMethod', function(this: any, options: HelperOptions) {
		// 	console.log('HTTP METHOD', this)
		// 	return this.method
		// })
		// Handlebars.registerHelper('helperMissing', function(this: any) {
		// 	const options = arguments[arguments.length - 1];

		Handlebars.registerHelper('indent', function(this: {}, indentString: string, options: HelperOptions) {
			const result = options.fn(this)
			// const indentString = '\t'.repeat(indent)
			return result.replace(/^/gm, indentString)
		})

		// 	console.log(options.name)


		// 	// const args = Array.prototype.slice.call(arguments, 0, arguments.length-1)
		// 	// return new Handlebars.SafeString("Missing: " + options.name + "(" + args + ")")
		// })
		// console.log(JSON.stringify(apiInfo, undefined, 2))

		// await loadTemplates('./server-stub/templates')
		// await emit('pom', './output/pom.xml', api)
		// await emit('api', './output/Api.java', api)
		await loadTemplates(commandLineOptions.template)

		const options: CodegenOptionsJava = state.options as CodegenOptionsJava
		const rootContext: CodegenRootContextJava = {
			generatorClass: 'openapi-generator-node',
			generatedDate: new Date().toISOString(),

			package: options.apiPackage,
		}

		const outputPath = commandLineOptions.output

		const apiPackagePath = packageToPath(rootContext.package)
		for (const groupName in doc.groups) {
			await emit('api', `${outputPath}/${apiPackagePath}/${config.toClassName(groupName, state)}Api.java`, prepareApiContext(doc.groups[groupName], state, rootContext), true)
		}

		for (const groupName in doc.groups) {
			await emit('apiService', `${outputPath}/${apiPackagePath}/${config.toClassName(groupName, state)}ApiService.java`, prepareApiContext(doc.groups[groupName], state, rootContext), true)
		}

		rootContext.package = options.apiServiceImplPackage

		const apiImplPackagePath = packageToPath(rootContext.package)
		for (const groupName in doc.groups) {
			await emit('apiServiceImpl', `${outputPath}/${apiImplPackagePath}/${config.toClassName(groupName, state)}ApiServiceImpl.java`, 
				prepareApiContext(doc.groups[groupName], state, rootContext), true)
		}

		rootContext.package = options.modelPackage

		const modelPackagePath = packageToPath(rootContext.package)
		for (const modelName in doc.schemas) {
			const context = {
				models: {
					model: [doc.schemas[modelName]],
				},
			}
			await emit('model', `${outputPath}/${modelPackagePath}/${config.toClassName(modelName, state)}.java`, prepareApiContext(context, state, rootContext), true)
		}

		for (const modelName in state.anonymousModels) {
			const context = {
				models: {
					model: [state.anonymousModels[modelName]],
				},
			}
			await emit('model', `${outputPath}/${modelPackagePath}/${config.toClassName(modelName, state)}.java`, prepareApiContext(context, state, rootContext), true)
		}

		
	} catch (error) {
		console.warn('API validation failed', error)
	}
}

/**
 * Turns a Java package name into a path
 * @param packageName Java package name
 */
function packageToPath(packageName: string) {
	return packageName.replace(/\./g, path.sep)
}

run()
