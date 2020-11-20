import { OpenAPI, OpenAPIV2, OpenAPIV3 } from 'openapi-types'
import { CodegenDocument, CodegenOperation, CodegenResponse, CodegenProperty, CodegenParameter, CodegenMediaType, CodegenVendorExtensions, CodegenModel, CodegenSecurityScheme, CodegenAuthScope as CodegenSecurityScope, CodegenOperationGroup, CodegenServer, CodegenOperationGroups, CodegenNativeType, CodegenTypePurpose, CodegenArrayTypePurpose, CodegenMapTypePurpose, CodegenContent, CodegenParameterIn, CodegenOAuthFlow, CodegenSecurityRequirement, CodegenPropertyType, CodegenLiteralValueOptions, CodegenTypeInfo, HttpMethods, CodegenDiscriminatorMappings, CodegenDiscriminator, CodegenGeneratorType, CodegenScope, CodegenSchema, CodegenExamples, CodegenRequestBody, CodegenExample, CodegenModels, CodegenParameters, CodegenResponses, CodegenProperties, CodegenEnumValues, CodegenSchemaPurpose, CodegenSchemaNameOptions, CodegenSchemaInfo, CodegenSchemaType, CodegenHeaders, CodegenHeader } from '@openapi-generator-plus/types'
import { isOpenAPIV2ResponseObject, isOpenAPIReferenceObject, isOpenAPIV3ResponseObject, isOpenAPIV2GeneralParameterObject, isOpenAPIV2Document, isOpenAPIV3Operation, isOpenAPIV3Document, isOpenAPIV2SecurityScheme, isOpenAPIV3SecurityScheme, isOpenAPIV2ExampleObject, isOpenAPIV3ExampleObject, isOpenAPIv3SchemaObject, isOpenAPIV3PathItemObject, isOpenAPIV2HeaderObject, isOpenAPIV3HeaderObject } from './openapi-type-guards'
import { OpenAPIX } from './types/patches'
import _ from 'lodash'
import { stringLiteralValueOptions } from './utils'
import { InternalCodegenState } from './types'
import * as idx from '@openapi-generator-plus/indexed-type'

function groupOperations(operationInfos: CodegenOperation[], state: InternalCodegenState) {
	const strategy = state.generator.operationGroupingStrategy()

	const groups: CodegenOperationGroups = {}
	for (const operationInfo of operationInfos) {
		strategy(operationInfo, groups, state)
	}

	return _.values(groups)
}

function processCodegenDocument(doc: CodegenDocument, state: InternalCodegenState) {
	/* Process groups */
	for (const group of doc.groups) {
		processCodegenOperationGroup(group, state)
	}

	/* Process models */
	processCodegenModels(doc.models, state)

	/* Sort groups */
	doc.groups.sort((a, b) => a.name.localeCompare(b.name))

	/* Sort models */
	doc.models = idx.sortValues(doc.models, (a, b) => a.name.localeCompare(b.name))

	if (state.generator.postProcessDocument) {
		state.generator.postProcessDocument(doc)
	}
}

function processCodegenOperationGroup(group: CodegenOperationGroup, state: InternalCodegenState) {
	for (let i = 0; i < group.operations.length; i++) {
		const result = processCodegenOperation(group.operations[i], state)
		if (!result) {
			group.operations.splice(i, 1)
			i--
		}
	}

	/* Sort operations */
	group.operations.sort((a, b) => a.name.localeCompare(b.name))
}

function processCodegenModels(models: CodegenModels, state: InternalCodegenState) {
	for (const entry of idx.iterable(models)) {
		const result = processCodegenModel(entry[1], state)
		if (!result) {
			idx.remove(models, entry[0])
		} else {
			const subModels = entry[1].models
			if (subModels) {
				processCodegenModels(subModels, state)
			}
		}
	}
}

function processCodegenOperation(op: CodegenOperation, state: InternalCodegenState): boolean {
	if (hasNoGenerationRule(op, state)) {
		return false
	}
	
	return true
}

function processCodegenModel(model: CodegenModel, state: InternalCodegenState): boolean {
	if (hasNoGenerationRule(model, state)) {
		return false
	}

	if (state.generator.postProcessModel) {
		const result = state.generator.postProcessModel(model)
		if (result === false) {
			return false
		}
	}
	return true
}

function hasNoGenerationRule(ob: CodegenOperation | CodegenModel, state: InternalCodegenState): boolean {
	const generatorType = state.generator.generatorType()
	if (generatorType === CodegenGeneratorType.SERVER) {
		return (ob.vendorExtensions && ob.vendorExtensions['x-no-server'])
	} else if (generatorType === CodegenGeneratorType.CLIENT) {
		return (ob.vendorExtensions && ob.vendorExtensions['x-no-client'])
	} else {
		return false
	}
}

function toCodegenParameter(parameter: OpenAPI.Parameter, scopeName: string, state: InternalCodegenState): CodegenParameter {
	parameter = resolveReference(parameter, state)

	let schema: CodegenSchema | undefined
	let examples: CodegenExamples | undefined
	if (parameter.schema) {
		/* We pass [] as scopeNames so we create any nested models at the root of the models package,
		 * as we reference all models relative to the models package, but a parameter is in an
		 * operation. TODO it would be nice to improve this; maybe we can declare an enum in an Api
		 * interface... we'd just need to make sure that the nativeTypes referring to it were fixed.
		 * But we don't know the Api class name at this point. If we knew it, we could perhaps pass
		 * the package along with the scope names in all cases. 
		 * However it's sort of up to the templates to decide where to output models... so does that
		 * mean that we need to provide more info to toNativeType so it can put in full package names?
		 */
		schema = toCodegenSchema(parameter.schema, parameter.required || false, `${scopeName}_${parameter.name}`, CodegenSchemaPurpose.PARAMETER, null, state)

		examples = toCodegenExamples(parameter.example, parameter.examples, undefined, schema, state)
	} else if (isOpenAPIV2GeneralParameterObject(parameter, state.specVersion)) {
		schema = toCodegenSchema(parameter, parameter.required || false, `${scopeName}_${parameter.name}`, CodegenSchemaPurpose.PARAMETER, null, state)
	} else {
		throw new Error(`Cannot resolve schema for parameter: ${JSON.stringify(parameter)}`)
	}

	const result: CodegenParameter = {
		name: parameter.name,

		...extractCodegenSchemaInfo(schema),

		in: parameter.in as CodegenParameterIn,
		description: parameter.description,
		required: parameter.required || false,
		collectionFormat: isOpenAPIV2GeneralParameterObject(parameter, state.specVersion) ? parameter.collectionFormat : undefined, // TODO OpenAPI3
		examples,

		schema,

		vendorExtensions: toCodegenVendorExtensions(parameter),
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
			/* The body parameter will be extracted by the caller */
			break
		case 'formData':
			result.isFormParam = true
			break
		default:
			throw new Error(`Unsupported parameter "in" value: ${parameter.in}`)
	}

	return result
}

/**
 * Extract _just_ the CodegenTypeInfo properties from the source.
 */
function extractCodegenTypeInfo(source: CodegenTypeInfo): CodegenTypeInfo {
	return {
		type: source.type,
		format: source.format,
		propertyType: source.propertyType,

		nativeType: source.nativeType,
		componentSchema: source.componentSchema,
	}
}

/**
 * Extract _just_ the CodegenSchemaInfo properties from the source.
 */
function extractCodegenSchemaInfo(source: CodegenSchemaInfo): CodegenSchemaInfo {
	return {
		...extractCodegenTypeInfo(source),

		required: source.required,
		nullable: source.nullable,
		readOnly: source.readOnly,
		writeOnly: source.writeOnly,
		deprecated: source.deprecated,
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

function toCodegenOperationName(path: string, method: string, operation: OpenAPI.Operation, state: InternalCodegenState) {
	if (operation.operationId) {
		return operation.operationId
	}

	return state.generator.toOperationName(path, method)
}

function toCodegenParameters(parameters: OpenAPIX.Parameters, pathParameters: CodegenParameters | undefined, scopeName: string, state: InternalCodegenState): CodegenParameters | undefined {
	const result: CodegenParameters = idx.create()
	if (pathParameters) {
		idx.merge(result, pathParameters)
	}
	for (const parameter of parameters) {
		const codegenParameter = toCodegenParameter(parameter, scopeName, state)
		idx.set(result, codegenParameter.name, codegenParameter)
	}
	return idx.undefinedIfEmpty(result)
}

interface CodegenOperationContext {
	parameters?: CodegenParameters
	summary?: string
	description?: string
}

function toCodegenOperation(path: string, method: string, operation: OpenAPI.Operation, context: CodegenOperationContext, state: InternalCodegenState): CodegenOperation {
	const name = toCodegenOperationName(path, method, operation, state)
	const responses: CodegenResponses | undefined = toCodegenResponses(operation, name, state)
	const defaultResponse = responses ? idx.find(responses, r => r.isDefault) : undefined

	let parameters: CodegenParameters | undefined
	if (operation.parameters) {
		parameters = toCodegenParameters(operation.parameters, context.parameters, name, state)
	} else if (context.parameters) {
		parameters = idx.merge(idx.create(), context.parameters)
	}

	let consumes: CodegenMediaType[] | undefined
	let bodyParam: CodegenRequestBody | undefined

	if (isOpenAPIV3Operation(operation, state.specVersion)) {
		let requestBody = operation.requestBody
		requestBody = requestBody && resolveReference(requestBody, state)

		if (requestBody) {
			/* See toCodegenParameter for rationale about scopeNames */
			const requestBodyContents = toCodegenContentArray(requestBody.content, `${name}_request`, CodegenSchemaPurpose.REQUEST_BODY, null, state)
			if (!requestBodyContents.length) {
				throw new Error(`Request body contents is empty: ${path}`)
			}

			const commonTypes = commonTypeInfo(requestBodyContents)
			if (!commonTypes) {
				throw new Error(`Cannot find common types for request body contents: ${path}`)
			}
			consumes = findAllContentMediaTypes(requestBodyContents)
			if (!consumes) {
				throw new Error(`No contents for request body: ${path}`)
			}

			bodyParam = {
				name: toUniqueName('request', parameters && idx.allKeys(parameters)),

				...commonTypes,
				...extractCodegenSchemaInfo(requestBodyContents[0]),

				description: requestBody.description,
				required: requestBody.required || false,
				schema: requestBodyContents[0],
				
				contents: requestBodyContents,
				defaultContent: requestBodyContents[0],
				consumes,

				vendorExtensions: toCodegenVendorExtensions(requestBody),
			}
		}
	} else {
		consumes = toConsumeMediaTypes(operation as OpenAPIV2.OperationObject, state)

		/* Apply special body param properties */
		if (parameters) {
			const bodyParamEntry = idx.findEntry(parameters, p => p.in === 'body')
			if (bodyParamEntry) {
				if (!consumes) {
					throw new Error(`Consumes not specified for operation with body parameter: ${path}`)
				}

				const existingBodyParam = bodyParamEntry[1]
				const contents = consumes.map(mediaType => {
					const result: CodegenContent = {
						mediaType,
						schema: existingBodyParam.schema,
						...extractCodegenSchemaInfo(existingBodyParam),
					}
					return result
				})

				if (!contents.length) {
					throw new Error(`Request body contents is empty: ${path}`)
				}

				bodyParam = {
					...extractCodegenSchemaInfo(existingBodyParam),

					name: existingBodyParam.name,
					description: existingBodyParam.description,
					required: existingBodyParam.required,
					collectionFormat: existingBodyParam.collectionFormat,
					vendorExtensions: existingBodyParam.vendorExtensions,
					schema: existingBodyParam.schema,

					contents,
					defaultContent: contents[0],
					consumes,
				}
				idx.remove(parameters, bodyParamEntry[0])
			}
		}
	}

	/* Ensure parameters is undefined if empty, as generators rely on that */
	if (parameters && idx.isEmpty(parameters)) {
		parameters = undefined
	}

	let securityRequirements: CodegenSecurityRequirement[] | undefined
	if (operation.security) {
		securityRequirements = toCodegenSecurityRequirements(operation.security, state)
	} else if (state.root.security) {
		/* Use document-wide security requirements if the operation doesn't specify any */
		securityRequirements = toCodegenSecurityRequirements(state.root.security, state)
	}

	const op: CodegenOperation = {
		name,
		httpMethod: method,
		path, /* Path will later be made relative to a CodegenOperationGroup */
		fullPath: path,
		returnType: defaultResponse ? defaultResponse.type : undefined,
		returnNativeType: defaultResponse ? defaultResponse.nativeType : undefined,
		consumes,
		produces: responses ? toUniqueMediaTypes(idx.allValues(responses).reduce((collected, response) => response.produces ? [...collected, ...response.produces] : collected, [] as CodegenMediaType[])) : undefined,
		
		parameters,
		queryParams: parameters && idx.undefinedIfEmpty(idx.filter(parameters, p => p.isQueryParam)),
		pathParams: parameters && idx.undefinedIfEmpty(idx.filter(parameters, p => p.isPathParam)),
		headerParams: parameters && idx.undefinedIfEmpty(idx.filter(parameters, p => p.isHeaderParam)),
		cookieParams: parameters && idx.undefinedIfEmpty(idx.filter(parameters, p => p.isCookieParam)),
		formParams: parameters && idx.undefinedIfEmpty(idx.filter(parameters, p => p.isFormParam)),

		requestBody: bodyParam,

		securityRequirements,
		defaultResponse,
		responses,
		deprecated: operation.deprecated,
		summary: operation.summary || context.summary,
		description: operation.description || context.description,
		tags: operation.tags,
		vendorExtensions: toCodegenVendorExtensions(operation),
	}
	op.hasParamExamples = parametersHaveExamples(op.parameters)
	op.hasQueryParamExamples = parametersHaveExamples(op.queryParams)
	op.hasPathParamExamples = parametersHaveExamples(op.pathParams)
	op.hasHeaderParamExamples = parametersHaveExamples(op.headerParams)
	op.hasCookieParamExamples = parametersHaveExamples(op.cookieParams)
	op.hasRequestBodyExamples = requestBodyHasExamples(op.requestBody)
	op.hasFormParamExamples = parametersHaveExamples(op.formParams)
	op.hasResponseExamples = responsesHaveExamples(op.responses)
	return op
}

function parametersHaveExamples(parameters: CodegenParameters | undefined): boolean | undefined {
	if (!parameters) {
		return undefined
	}

	return !!idx.find(parameters, param => !!param.examples?.length)
}

function requestBodyHasExamples(parameter: CodegenRequestBody | undefined): boolean | undefined {
	if (!parameter || !parameter.contents) {
		return undefined
	}

	return !!parameter.contents.find(c => !!c.examples?.length)
}

function responsesHaveExamples(responses: CodegenResponses | undefined): boolean | undefined {
	if (!responses) {
		return undefined
	}

	return !!idx.findEntry(responses, response => response.contents && response.contents.find(c => !!c.examples?.length))
}

function toUniqueMediaTypes(mediaTypes: CodegenMediaType[]): CodegenMediaType[] {
	return _.uniqWith(mediaTypes, mediaTypeEquals)
}

function mediaTypeEquals(a: CodegenMediaType, b: CodegenMediaType): boolean {
	return a.mediaType === b.mediaType
}

function toCodegenSecuritySchemes(state: InternalCodegenState): CodegenSecurityScheme[] | undefined {
	if (isOpenAPIV2Document(state.root)) {
		if (!state.root.securityDefinitions) {
			return undefined
		}

		const result: CodegenSecurityScheme[] = []
		for (const name in state.root.securityDefinitions) {
			const securityDefinition = state.root.securityDefinitions[name]
			result.push(toCodegenSecurityScheme(name, securityDefinition, state))
		}
		return result
	} else if (isOpenAPIV3Document(state.root)) {
		const schemes = state.root.components?.securitySchemes
		if (!schemes) {
			return undefined
		}

		const result: CodegenSecurityScheme[] = []
		for (const name in schemes) {
			const securityDefinition = resolveReference(schemes[name], state)
			result.push(toCodegenSecurityScheme(name, securityDefinition, state))
		}
		return result
	} else {
		throw new Error(`Unsupported spec version: ${state.specVersion}`)
	}
}

function toCodegenSecurityRequirements(security: OpenAPIV2.SecurityRequirementObject[] | OpenAPIV3.SecurityRequirementObject[], state: InternalCodegenState): CodegenSecurityRequirement[] {
	const result: CodegenSecurityRequirement[] = []
	for (const securityElement of security) { /* Don't know why it's an array at the top level */
		for (const name in securityElement) {
			result.push(toCodegenSecurityRequirement(name, securityElement[name], state))
		}
	}
	return result
}

function toCodegenSecurityRequirement(name: string, scopes: string[], state: InternalCodegenState): CodegenSecurityRequirement {
	let definition: OpenAPIV2.SecuritySchemeObject | OpenAPIV3.SecuritySchemeObject
	if (isOpenAPIV2Document(state.root)) {
		if (!state.root.securityDefinitions) {
			throw new Error('security requirement found but no security definitions found')
		}

		definition = state.root.securityDefinitions[name]
	} else if (isOpenAPIV3Document(state.root)) {
		const schemes = state.root.components?.securitySchemes
		if (!schemes) {
			throw new Error('security requirement found but no security schemes found')
		}

		definition = resolveReference(schemes[name], state)
	} else {
		throw new Error(`Unsupported spec version: ${state.specVersion}`)
	}
	
	if (!definition) {
		throw new Error(`Security requirement references non-existent security definition: ${name}`)
	}

	const scheme = toCodegenSecurityScheme(name, definition, state)
	let scopeObjects: CodegenSecurityScope[] | undefined

	if (scopes && scheme.flows) {
		scopeObjects = []
		for (const scope of scopes) {
			const scopeObject = findSecurityScope(scope, scheme)
			if (scopeObject) {
				scopeObjects.push(scopeObject)
			} else {
				scopeObjects.push({
					name: scope,
				})
			}
		}
	}

	return {
		scheme,
		scopes: scopeObjects,
	}
}

function findSecurityScope(scope: string, scheme: CodegenSecurityScheme): CodegenSecurityScope | undefined {
	if (!scheme.flows) {
		return undefined
	}

	for (const flow of scheme.flows) {
		if (flow.scopes) {
			for (const flowScope of flow.scopes) {
				if (flowScope.name === scope) {
					return flowScope
				}
			}
		}
	}

	return undefined
}

function toCodegenSecurityScheme(name: string, scheme: OpenAPIV2.SecuritySchemeObject | OpenAPIV3.SecuritySchemeObject, state: InternalCodegenState): CodegenSecurityScheme {
	switch (scheme.type) {
		case 'basic':
			return {
				type: scheme.type,
				description: scheme.description,
				name,
				scheme: 'basic',
				isBasic: true,
				isHttp: true,
				vendorExtensions: toCodegenVendorExtensions(scheme),
			}
		case 'http':
			return {
				type: scheme.type,
				description: scheme.description,
				name,
				scheme: scheme.scheme,
				isBasic: true,
				isHttp: true,
				vendorExtensions: toCodegenVendorExtensions(scheme),
			}
		case 'apiKey': {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const apiKeyIn: string | undefined = (scheme as any).in // FIXME once openapi-types releases https://github.com/kogosoftwarellc/open-api/commit/1121e63df3aa7bd3dc456825106a668505db0624
			return {
				type: scheme.type,
				description: scheme.description,
				name,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				paramName: (scheme as any).name, // FIXME once openapi-types releases https://github.com/kogosoftwarellc/open-api/commit/1121e63df3aa7bd3dc456825106a668505db0624
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				in: apiKeyIn as any,
				isApiKey: true,
				isInHeader: apiKeyIn === 'header',
				isInQuery: apiKeyIn === 'query',
				vendorExtensions: toCodegenVendorExtensions(scheme),
			}
		}
		case 'oauth2': {
			let flows: CodegenOAuthFlow[] | undefined
			if (isOpenAPIV2SecurityScheme(scheme, state.specVersion)) {
				flows = [{
					type: scheme.flow,
					authorizationUrl: scheme.flow === 'implicit' || scheme.flow === 'accessCode' ? scheme.authorizationUrl : undefined,
					tokenUrl: scheme.flow === 'password' || scheme.flow === 'application' || scheme.flow === 'accessCode' ? scheme.tokenUrl : undefined,
					scopes: toCodegenAuthScopes(scheme.scopes),
				}]
			} else if (isOpenAPIV3SecurityScheme(scheme, state.specVersion)) {
				flows = toCodegenOAuthFlows(scheme)
			}
			return {
				type: scheme.type,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				description: (scheme as any).description,
				name,
				flows,
				isOAuth: true,
				vendorExtensions: toCodegenVendorExtensions(scheme),
			}
		}
		case 'openIdConnect':
			return {
				type: scheme.type,
				description: scheme.description,
				name,
				openIdConnectUrl: scheme.openIdConnectUrl,
			}
		default:
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			throw new Error(`Unsupported security scheme type: ${(scheme as any).type}`)
	}
}

function toCodegenOAuthFlows(scheme: OpenAPIV3.OAuth2SecurityScheme): CodegenOAuthFlow[] {
	const result: CodegenOAuthFlow[] = []
	if (scheme.flows.implicit) {
		result.push({
			type: 'implicit',
			authorizationUrl: scheme.flows.implicit.authorizationUrl,
			refreshUrl: scheme.flows.implicit.refreshUrl,
			scopes: toCodegenAuthScopes(scheme.flows.implicit.scopes),
			vendorExtensions: toCodegenVendorExtensions(scheme.flows.implicit),
		})
	}
	if (scheme.flows.password) {
		result.push({
			type: 'password',
			tokenUrl: scheme.flows.password.tokenUrl,
			refreshUrl: scheme.flows.password.refreshUrl,
			scopes: toCodegenAuthScopes(scheme.flows.password.scopes),
		})
	}
	if (scheme.flows.authorizationCode) {
		result.push({
			type: 'authorizationCode',
			authorizationUrl: scheme.flows.authorizationCode.authorizationUrl,
			tokenUrl: scheme.flows.authorizationCode.tokenUrl,
			refreshUrl: scheme.flows.authorizationCode.refreshUrl,
			scopes: toCodegenAuthScopes(scheme.flows.authorizationCode.scopes),
		})
	}
	if (scheme.flows.clientCredentials) {
		result.push({
			type: 'clientCredentials',
			tokenUrl: scheme.flows.clientCredentials.tokenUrl,
			refreshUrl: scheme.flows.clientCredentials.refreshUrl,
			scopes: toCodegenAuthScopes(scheme.flows.clientCredentials.scopes),
		})
	}
	return result
}

function toCodegenAuthScopes(scopes: OpenAPIV2.ScopesObject): CodegenSecurityScope[] | undefined {
	const vendorExtensions = toCodegenVendorExtensions(scopes)

	/* A bug in the swagger parser? The openapi-types don't suggest that scopes should be an array */
	if (Array.isArray(scopes)) {
		scopes = scopes[0]
	}

	const result: CodegenSecurityScope[] = []
	for (const name in scopes) {
		const scopeDescription = scopes[name]
		result.push({
			name: name,
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
function resolveReference<T>(ob: T | OpenAPIV3.ReferenceObject | OpenAPIV2.ReferenceObject, state: InternalCodegenState): T {
	if (isOpenAPIReferenceObject(ob)) {
		return state.$refs.get(ob.$ref)
	} else {
		return ob
	}
}

function toConsumeMediaTypes(op: OpenAPIV2.OperationObject, state: InternalCodegenState): CodegenMediaType[] | undefined {
	if (op.consumes) {
		return op.consumes?.map(mediaType => toCodegenMediaType(mediaType))
	} else {
		const doc = state.root as OpenAPIV2.Document
		if (doc.consumes) {
			return doc.consumes.map(mediaType => toCodegenMediaType(mediaType))
		} else {
			return undefined
		}
	}
}

function toProduceMediaTypes(op: OpenAPIV2.OperationObject, state: InternalCodegenState): CodegenMediaType[] | undefined {
	if (op.produces) {
		return op.produces.map(mediaType => toCodegenMediaType(mediaType))
	} else {
		const doc = state.root as OpenAPIV2.Document
		if (doc.produces) {
			return doc.produces.map(mediaType => toCodegenMediaType(mediaType))
		} else {
			return undefined
		}
	}
}

function toCodegenResponses(operation: OpenAPI.Operation, scopeName: string, state: InternalCodegenState): CodegenResponses | undefined {
	const responses = operation.responses
	if (!responses) {
		return undefined
	}

	const result: CodegenResponses = idx.create()

	let bestCode: number | undefined
	let bestResponse: CodegenResponse | undefined

	for (const responseCodeString in responses) {
		const responseCode = responseCodeString === 'default' ? 0 : parseInt(responseCodeString, 10)
		const response = toCodegenResponse(operation, responseCode, responses[responseCodeString], false, scopeName, state)

		idx.set(result, `${responseCode}`, response)

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

	return idx.undefinedIfEmpty(result)
}

/**
 * Convert a `$ref` into a name that could be turned into a type.
 * @param $ref 
 */
function nameFromRef($ref: string): string | undefined {
	const i = $ref.indexOf('#')
	if (i === -1) {
		return undefined
	}

	$ref = $ref.substring(i + 1)
	const components = $ref.split('/')
	return components[components.length - 1]
}

function toCodegenResponse(operation: OpenAPI.Operation, code: number, response: OpenAPIX.Response, isDefault: boolean, scopeName: string, state: InternalCodegenState): CodegenResponse {
	response = resolveReference(response, state)

	if (code === 0) {
		code = 200
	}
	
	let contents: CodegenContent[] | undefined

	if (isOpenAPIV2ResponseObject(response, state.specVersion)) {
		if (response.schema) {
			/* We don't pass scopeNames to toCodegenProperty; see toCodegenParameter for rationale */
			const schema = toCodegenSchema(response.schema, true, `${scopeName}_${code}_response`, CodegenSchemaPurpose.RESPONSE, null, state)
			const examples = toCodegenExamples(undefined, response.examples, undefined, schema, state)

			const mediaTypes = toProduceMediaTypes(operation as OpenAPIV2.OperationObject, state)
			contents = mediaTypes ? mediaTypes.map(mediaType => {
				const result: CodegenContent = {
					mediaType,
					schema,
					examples: examples && examples[mediaType.mediaType] ? { default: examples[mediaType.mediaType] } : undefined,
					...extractCodegenSchemaInfo(schema),
				}
				return result
			}) : undefined
		}
	} else if (isOpenAPIV3ResponseObject(response, state.specVersion)) {
		if (response.content) {
			/* We don't pass scopeNames to toCodegenProperty; see toCodegenParameter for rationale */
			contents = toCodegenContentArray(response.content, `${scopeName}_${code}_response`, CodegenSchemaPurpose.RESPONSE, null, state)
		}
	} else {
		throw new Error(`Unsupported response: ${JSON.stringify(response)}`)
	}

	/* Determine if there's a common type and nativeType */
	const commonTypes = commonTypeInfo(contents)
	const produces = findAllContentMediaTypes(contents)

	const defaultContent = (contents && contents.length) ? contents[0] : undefined

	return {
		code,
		description: response.description,
		isDefault,
		...commonTypes,
		contents,
		defaultContent,
		produces,
		headers: toCodegenHeaders(response.headers, state),
		vendorExtensions: toCodegenVendorExtensions(response),

		...(defaultContent ? extractCodegenSchemaInfo(defaultContent) : {}),
	}
}



function toCodegenHeaders(headers: OpenAPIX.Headers | undefined, state: InternalCodegenState): CodegenHeaders | undefined {
	if (headers === undefined) {
		return undefined
	}

	const result: CodegenHeaders = {}
	for (const key in headers) {
		const header = toCodegenHeader(key, headers[key], state)
		result[key] = header
	}
	return result
}

function toCodegenHeader(name: string, header: OpenAPIX.Header, state: InternalCodegenState): CodegenHeader {
	header = resolveReference(header, state)

	if (isOpenAPIV2HeaderObject(header, state.specVersion)) {
		const schema = toCodegenSchema(header, true, name, CodegenSchemaPurpose.HEADER, null, state)
		return {
			name,
	
			...extractCodegenSchemaInfo(schema),
	
			required: false,
			collectionFormat: header.collectionFormat,
	
			schema,
	
			vendorExtensions: toCodegenVendorExtensions(header),
		}
	} else if (isOpenAPIV3HeaderObject(header, state.specVersion)) {
		if (!header.schema) {
			throw new Error(`Cannot resolve schema for header "${name}: ${JSON.stringify(header)}`)
		}
		
		const schema = toCodegenSchema(header.schema, header.required || false, name, CodegenSchemaPurpose.HEADER, null, state)
		const examples = toCodegenExamples(header.example, header.examples, undefined, schema, state)

		return {
			name,
	
			...extractCodegenSchemaInfo(schema),
	
			description: header.description,
			required: header.required || false,
			examples,
	
			schema,
	
			vendorExtensions: toCodegenVendorExtensions(header),
		}
	} else {
		throw 'Unsupported spec version'
	}
}

type OpenAPIV3Examples = { [name: string]: OpenAPIV3.ReferenceObject | OpenAPIV3.ExampleObject }

function canFormatExampleValueAsLiteral(schema: CodegenTypeInfo) {
	return schema.propertyType !== CodegenPropertyType.ARRAY && schema.propertyType !== CodegenPropertyType.OBJECT && schema.propertyType !== CodegenPropertyType.FILE
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function exampleValue(value: any, mediaType: string | undefined, schema: CodegenSchemaInfo, state: InternalCodegenState): Pick<CodegenExample, 'value' | 'valueLiteral' | 'valueString' | 'valuePretty'> {
	return {
		value,
		valueLiteral: canFormatExampleValueAsLiteral(schema) ? state.generator.toLiteral(value, schema) : value,
		valueString: toCodegenExampleValueString(value, mediaType, state),
		valuePretty: toCodegenExampleValuePretty(value),
		...extractCodegenTypeInfo(schema),
	}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toCodegenExamples(example: any | undefined, examples: OpenAPIV2.ExampleObject | OpenAPIV3Examples | undefined, mediaType: string | undefined, schema: CodegenSchemaInfo, state: InternalCodegenState): CodegenExamples | undefined {
	if (example) {
		return idx.create([
			['default', {
				...exampleValue(example, mediaType, schema, state),
				mediaType: mediaType ? toCodegenMediaType(mediaType) : undefined,
				...extractCodegenTypeInfo(schema),
			}],
		])
	}

	if (!examples) {
		return undefined
	}

	const result: CodegenExamples = idx.create()
	for (const mediaTypeOrName in examples) {
		const example = examples[mediaTypeOrName]
		if (isOpenAPIV2ExampleObject(example, state.specVersion)) {
			idx.set(result, mediaTypeOrName, {
				mediaType: toCodegenMediaType(mediaTypeOrName),
				...exampleValue(example, mediaTypeOrName, schema, state),
				...extractCodegenTypeInfo(schema),
			})
		} else if (isOpenAPIV3ExampleObject(example, state.specVersion)) {
			const value = example.value || example.externalValue // TODO handle externalValue
			idx.set(result, mediaTypeOrName, {
				name: mediaTypeOrName,
				mediaType: mediaType ? toCodegenMediaType(mediaType) : undefined,
				description: example.description,
				summary: example.summary,
				...exampleValue(value, mediaType, schema, state),
				...extractCodegenTypeInfo(schema),
			})
		} else {
			throw new Error(`Unsupported spec version: ${state.specVersion}`)
		}
	}

	return idx.undefinedIfEmpty(result)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toCodegenExampleValueString(value: any, mediaType: string | undefined, state: InternalCodegenState) {
	if (typeof value === 'string') {
		return state.generator.toLiteral(value, stringLiteralValueOptions(state.generator))
	} else {
		// TODO we're assuming that we're transforming an object to JSON, which is appropriate is the mediaType is JSON
		const stringValue = JSON.stringify(value)
		return state.generator.toLiteral(stringValue, stringLiteralValueOptions(state.generator))
	}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toCodegenExampleValuePretty(value: any) {
	if (typeof value === 'string') {
		return value
	} else {
		// TODO we're assuming that we're transforming an object to JSON, which is appropriate is the mediaType is JSON
		return JSON.stringify(value, undefined, 4)
	}
}

/**
 * Finds the common property type info from the array of CodegenContent, or returns `undefined` if there
 * is no common property type info.
 */
function commonTypeInfo(contents: CodegenContent[] | undefined): CodegenTypeInfo | undefined {
	if (!contents || !contents.length) {
		return undefined
	}

	let result: CodegenTypeInfo | undefined
	
	for (const content of contents) {
		if (!result) {
			result = extractCodegenTypeInfo(content)
		} else {
			if (content.type !== result.type) {
				return undefined
			}
			if (content.format !== result.format) {
				return undefined
			}
			if (content.nativeType && result.nativeType) {
				if (!content.nativeType.equals(result.nativeType)) {
					return undefined
				}
			} else if (content.nativeType !== result.nativeType) {
				return undefined
			}
		}
	}
	return result
}

function findAllContentMediaTypes(contents: CodegenContent[] | undefined): CodegenMediaType[] | undefined {
	if (!contents || !contents.length) {
		return undefined
	}

	return contents.reduce((existing, content) => content.mediaType ? [...existing, content.mediaType] : existing, [] as CodegenMediaType[])
}

function toCodegenContentArray(content: { [media: string]: OpenAPIV3.MediaTypeObject }, suggestedModelName: string, purpose: CodegenSchemaPurpose, scope: CodegenScope | null, state: InternalCodegenState): CodegenContent[] {
	const result: CodegenContent[] = []
	for (const mediaType in content) {
		const mediaTypeContent = content[mediaType]

		if (!mediaTypeContent.schema) {
			throw new Error('Media type content without a schema')
		}
		const schema = toCodegenSchema(mediaTypeContent.schema, true, suggestedModelName, purpose, scope, state)

		const examples: CodegenExamples | undefined = toCodegenExamples(mediaTypeContent.example, mediaTypeContent.examples, mediaType, schema, state)

		const item: CodegenContent = {
			mediaType: toCodegenMediaType(mediaType),
			examples,
			schema,
			...extractCodegenSchemaInfo(schema),
		}
		result.push(item)
	}

	return result
}

function toCodegenMediaType(mediaType: string): CodegenMediaType {
	const i = mediaType.indexOf(';')
	if (i === -1) {
		return {
			mediaType,
			mimeType: mediaType,
		}
	}

	let charset: string | undefined

	const matches = mediaType.match(/charset\s*=\s*([-a-zA-Z0-9_]+)/i)
	if (matches) {
		charset = matches[1]
	}
	
	return {
		mediaType,
		mimeType: mediaType.substring(0, i),
		encoding: charset,
	}
}

function toCodegenProperty(name: string, schema: OpenAPIX.SchemaObject, required: boolean, scope: CodegenScope | null, state: InternalCodegenState): CodegenProperty {
	const codegenSchema = toCodegenSchema(schema, required, name, CodegenSchemaPurpose.PROPERTY, scope, state)
	return {
		...codegenSchema,
		name,
	}
}

function toCodegenSchema(schema: OpenAPIX.SchemaObject, required: boolean, suggestedModelName: string, purpose: CodegenSchemaPurpose, scope: CodegenScope | null, state: InternalCodegenState): CodegenSchema {
	let type: string
	let format: string | undefined
	let nativeType: CodegenNativeType
	let componentSchema: CodegenSchema | undefined
	let propertyType: CodegenPropertyType
	let model: CodegenModel | undefined

	const originalSchema = schema
	schema = resolveReference(schema, state)
	fixSchema(schema, state)

	if (isModelSchema(schema, state)) {
		model = toCodegenModel(suggestedModelName, purpose, scope, originalSchema, state)
		type = model.type
		format = model.format
		nativeType = model.propertyNativeType
		propertyType = model.propertyType
	} else {
		if (schema.type === 'array') {
			if (!schema.items) {
				throw new Error('items missing for schema type "array"')
			}
			type = 'array'
			propertyType = CodegenPropertyType.ARRAY
	
			const result = handleArraySchema(originalSchema, suggestedModelName, scope, CodegenArrayTypePurpose.PROPERTY, state)
			componentSchema = result.componentSchema
			nativeType = result.nativeType
		} else if (schema.type === 'object') {
			if (schema.additionalProperties) {
				type = 'object'
				propertyType = CodegenPropertyType.MAP

				const result = handleMapSchema(originalSchema, suggestedModelName, scope, CodegenMapTypePurpose.PROPERTY, state)
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
				required,
				vendorExtensions: toCodegenVendorExtensions(schema),
				purpose: CodegenTypePurpose.PROPERTY,
			})
			propertyType = toCodegenPropertyType(type, format, false, false)
		} else {
			throw new Error(`Unsupported schema type "${schema.type}" for property in ${JSON.stringify(schema)}`)
		}
	}

	const result: CodegenSchema = {
		description: coalesce(originalSchema.description, schema.description),
		title: coalesce(originalSchema.title, schema.title),
		readOnly: coalesce(originalSchema.readOnly != undefined ? !!originalSchema.readOnly : undefined, schema.readOnly !== undefined ? !!schema.readOnly : undefined) || false,
		nullable: false, /* Set below for OpenAPI V3 */
		writeOnly: false, /* Set below for OpenAPI V3 */
		deprecated: false, /* Set below for OpenAPI V3 */
		required,
		vendorExtensions: toCodegenVendorExtensions(schema),

		type,
		format: schema.format,
		propertyType,
		nativeType,

		/* Validation */
		maximum: coalesce(originalSchema.maximum, schema.maximum),
		exclusiveMaximum: coalesce(originalSchema.exclusiveMaximum, schema.exclusiveMaximum),
		minimum: coalesce(originalSchema.minimum, schema.minimum),
		exclusiveMinimum: coalesce(originalSchema.exclusiveMinimum, schema.exclusiveMinimum),
		maxLength: coalesce(originalSchema.maxLength, schema.maxLength),
		minLength: coalesce(originalSchema.minLength, schema.minLength),
		pattern: coalesce(originalSchema.pattern, schema.pattern),
		maxItems: coalesce(originalSchema.maxItems, schema.maxItems),
		minItems: coalesce(originalSchema.minItems, schema.minItems),
		uniqueItems: coalesce(originalSchema.uniqueItems, schema.uniqueItems),
		multipleOf: coalesce(originalSchema.multipleOf, schema.multipleOf),

		/* Model */
		model,
		componentSchema,
	}

	if (isOpenAPIv3SchemaObject(originalSchema, state.specVersion) && isOpenAPIv3SchemaObject(schema, state.specVersion)) {
		result.nullable = coalesce(originalSchema.nullable, schema.nullable) || false
		result.writeOnly = coalesce(originalSchema.writeOnly, schema.writeOnly) || false
		result.deprecated = coalesce(originalSchema.deprecated, schema.deprecated) || false
	}

	result.defaultValue = state.generator.toDefaultValue(schema.default, result)
	return result
}

function coalesce<T>(...values: (T | undefined)[]): T | undefined {
	for (const value of values) {
		if (value !== undefined) {
			return value
		}
	}
	return undefined
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
	const componentSchema = toCodegenSchema(schema.items, true, suggestedItemModelName, CodegenSchemaPurpose.ARRAY_ITEM, scope, state)
	const nativeType = state.generator.toNativeArrayType({
		componentNativeType: componentSchema.nativeType,
		uniqueItems: schema.uniqueItems,
		purpose,
		vendorExtensions: toCodegenVendorExtensions(schema),
	})

	return {
		componentSchema,
		nativeType,
	}
}

function handleMapSchema(schema: OpenAPIX.SchemaObject, suggestedModelName: string, scope: CodegenScope | null, purpose: CodegenMapTypePurpose, state: InternalCodegenState): HandleSchemaResult {
	if (isOpenAPIReferenceObject(schema)) {
		/* This schema is a reference, so our item schema shouldn't be nested in whatever parent
		   scope we came from.
		 */
		const possibleName = nameFromRef(schema.$ref)
		if (possibleName) {
			suggestedModelName = possibleName
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
	const componentSchema = toCodegenSchema(schema.additionalProperties, true, suggestedModelName, CodegenSchemaPurpose.MAP_VALUE, scope, state)

	const nativeType = state.generator.toNativeMapType({
		keyNativeType,
		componentNativeType: componentSchema.nativeType,
		vendorExtensions: toCodegenVendorExtensions(schema),
		purpose,
	})

	return {
		componentSchema,
		nativeType,
	}
}

function toCodegenPropertyType(type: string, format: string | undefined, isEnum: boolean, isMap: boolean): CodegenPropertyType {
	if (isMap) {
		return CodegenPropertyType.MAP
	} else if (isEnum) {
		return CodegenPropertyType.ENUM
	} else if (type === 'object') {
		return CodegenPropertyType.OBJECT
	} else if (type === 'array') {
		return CodegenPropertyType.ARRAY
	} else if (type === 'boolean') {
		return CodegenPropertyType.BOOLEAN
	} else if (type === 'number' || type === 'integer') {
		return CodegenPropertyType.NUMBER
	} else if (type === 'string' && format === 'date-time') {
		return CodegenPropertyType.DATETIME
	} else if (type === 'string' && format === 'date') {
		return CodegenPropertyType.DATE
	} else if (type === 'string' && format === 'time') {
		return CodegenPropertyType.TIME
	} else if (type === 'string') {
		return CodegenPropertyType.STRING
	} else if (type === 'file') {
		return CodegenPropertyType.FILE
	} else {
		throw new Error(`Unsupported property type: ${type}`)
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
		name = state.generator.toIteratedModelName(proposedName, scopeNames, iteration)
	} while (state.usedModelFullyQualifiedNames[fullyQualifiedModelName([...scopeNames, name])])

	return [...scopeNames, name]
}

function toUniqueName(suggestedName: string, existingNames: string[] | undefined): string {
	if (!existingNames) {
		return suggestedName
	}

	const baseName = suggestedName
	let iteration = 0
	while (existingNames.indexOf(suggestedName) !== -1) {
		iteration += 1
		suggestedName = `${baseName}${iteration}`
	}
	return suggestedName
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

function toCodegenSchemaType(schema: OpenAPIX.SchemaObject, state: InternalCodegenState) {
	schema = resolveReference(schema, state)

	if (schema.enum) {
		return CodegenSchemaType.ENUM
	} else if (schema.type === 'array') {
		return CodegenSchemaType.ARRAY
	} else if (schema.additionalProperties) {
		return CodegenSchemaType.MAP
	} else {
		return CodegenSchemaType.OBJECT
	}
}

interface ScopedModelInfo {
	scopedName: string[]
	scope: CodegenScope | null
}

function toScopedName(suggestedName: string, purpose: CodegenSchemaPurpose, scope: CodegenScope | null, schema: OpenAPIX.SchemaObject, state: InternalCodegenState): ScopedModelInfo {
	let nameSpecified = false

	if (isOpenAPIReferenceObject(schema)) {
		/* We always want referenced schemas to be at the top-level */
		scope = null

		const refName = nameFromRef(schema.$ref)
		if (refName) {
			suggestedName = refName
			nameSpecified = true
		}

		/* Resolve the schema for the following checks */
		schema = resolveReference(schema, state)
	}

	const vendorExtensions = toCodegenVendorExtensions(schema)
	/* Support vendor extension to override the automatic naming of schemas */
	if (vendorExtensions && vendorExtensions['x-schema-name']) {
		suggestedName = vendorExtensions['x-schema-name']
		nameSpecified = true
	}

	const nameOptions: CodegenSchemaNameOptions = {
		nameSpecified,
		schemaType: toCodegenSchemaType(schema, state),
		purpose,
	}
	let name = state.generator.toSchemaName(suggestedName, nameOptions)

	if (scope) {
		/* Check that our name is unique in our scope, as some languages (Java) don't allow an inner class to shadow an ancestor */
		const originalName = name
		let iteration = 0
		while (scope.scopedName.indexOf(name) !== -1) {
			iteration += 1
			name = state.generator.toIteratedModelName(originalName, scope.scopedName, iteration)
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

function toUniqueScopedName(suggestedName: string, purpose: CodegenSchemaPurpose, scope: CodegenScope | null, schema: OpenAPIX.SchemaObject, state: InternalCodegenState) {
	const result = toScopedName(suggestedName, purpose, scope, schema, state)

	const reservedName = isOpenAPIReferenceObject(schema) ? state.reservedNames[schema.$ref] : undefined
	if (reservedName !== fullyQualifiedModelName(result.scopedName)) {
		/* Model types that aren't defined in the spec need to be made unique */
		result.scopedName = uniqueModelName(result.scopedName, state)
	}

	return result
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

function toCodegenModel(suggestedName: string, purpose: CodegenSchemaPurpose, suggestedScope: CodegenScope | null, schema: OpenAPIX.SchemaObject, state: InternalCodegenState): CodegenModel {
	const $ref = isOpenAPIReferenceObject(schema) ? schema.$ref : undefined
	const partial = purpose === CodegenSchemaPurpose.PARTIAL_MODEL
	const { scopedName, scope } = partial ? toScopedName(suggestedName, purpose, suggestedScope, schema, state) : toUniqueScopedName(suggestedName, purpose, suggestedScope, schema, state)
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

	const isEnum = !!schema.enum
	const vendorExtensions = toCodegenVendorExtensions(schema)

	const model: CodegenModel = {
		name,
		serializedName: $ref ? nameFromRef($ref) : undefined,
		scopedName,
		description: schema.description,
		vendorExtensions,
		nativeType,
		propertyNativeType,
		type: 'object',
		propertyType: isEnum ? CodegenPropertyType.ENUM : schema.additionalProperties ? CodegenPropertyType.MAP : CodegenPropertyType.OBJECT,
	}

	if (isOpenAPIv3SchemaObject(schema, state.specVersion)) {
		model.deprecated = schema.deprecated
	}

	/* Add to known models */
	if (!partial) {
		state.usedModelFullyQualifiedNames[fullyQualifiedModelName(scopedName)] = true
		state.modelsBySchema.set(schema, model)
	}

	model.properties = toCodegenModelProperties(schema, model, state)

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
		const purpose = isOpenAPIReferenceObject(otherSchema) ? CodegenSchemaPurpose.MODEL : CodegenSchemaPurpose.PARTIAL_MODEL
		const otherSchemaObject = toCodegenSchema(otherSchema, true, name, purpose, scope, state)
		const otherSchemaModel = otherSchemaObject.model
		if (!otherSchemaModel) {
			throw new Error(`Cannot absorb schema as it isn't a model: ${otherSchema}`)
		}

		/* We only include nested models if the model being observed won't actually exist to contain its nested models itself */
		absorbModel(otherSchemaModel, { includeNestedModels: purpose === CodegenSchemaPurpose.PARTIAL_MODEL })
		return otherSchemaModel
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
				const parentSchema = toCodegenSchema(possibleParentSchema, true, 'parent', CodegenSchemaPurpose.MODEL, suggestedScope, state)
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
			const subSchemaObject = toCodegenSchema(subSchema, true, 'submodel', CodegenSchemaPurpose.MODEL, model, state)
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
				propertyType: CodegenPropertyType.STRING,
				nativeType: state.generator.toNativeType({ type: 'string', required: true, purpose: CodegenTypePurpose.DISCRIMINATOR }),
			}
			
			for (const subSchema of oneOf) {
				const subSchemaObject = toCodegenSchema(subSchema, true, 'submodel', CodegenSchemaPurpose.MODEL, model, state)
				const subModel = subSchemaObject.model
				if (!subModel) {
					throw new Error(`Non-model schema not support in oneOf with discriminator: ${subSchema}`)
				}

				const subModelDiscriminatorProperty = removeModelProperty(subModel.properties, schemaDiscriminator.propertyName)
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
				const subSchemaObject = toCodegenSchema(subSchema, true, 'submodel', CodegenSchemaPurpose.MODEL, model, state)
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
					const fakeName = toUniqueScopedName('fake', CodegenSchemaPurpose.PARTIAL_MODEL, model, subSchema, state)
					const fakeModel: CodegenModel = {
						...subSchemaObject,
						name: fakeName.scopedName[fakeName.scopedName.length - 1],
						propertyNativeType: subSchemaObject.nativeType,
						scopedName: fakeName.scopedName,
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
		const enumValuePropertyType = toCodegenPropertyType(enumValueType, enumValueFormat, false, false)

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
			propertyType: enumValuePropertyType,
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
			model.enumValues = idx.undefinedIfEmpty(enumValues)
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

			const discriminatorProperty = removeModelProperty(model.properties, schemaDiscriminator.propertyName)
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
	if (model.properties && idx.isEmpty(model.properties)) {
		model.properties = undefined
	}

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

/**
 * Sometimes a schema omits the `type`, even though the specification states that it must be a `string`.
 * This method corrects for those cases where we can determine what the schema _should_ be.
 * @param schema 
 */
function fixSchema(schema: OpenAPIX.SchemaObject, state: InternalCodegenState) {
	if (schema.type === undefined && (schema.required || schema.properties || schema.additionalProperties)) {
		schema.type = 'object'
	}

	/* Some specs have the enum declared at the array level, rather than the items. The Vimeo API schema is an example.
	   https://raw.githubusercontent.com/vimeo/openapi/master/api.yaml
	*/
	if (schema.type === 'array' && schema.enum) {
		if (schema.items) {
			const items = resolveReference(schema.items, state)
			if (!items.enum) {
				items.enum = schema.enum
				schema.enum = undefined
			}
		}
	}
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

function toCodegenServers(root: OpenAPI.Document): CodegenServer[] | undefined {
	if (isOpenAPIV2Document(root)) {
		if (root.schemes && root.host) {
			return root.schemes.map(scheme => ({
				url: `${scheme}://${root.host}${root.basePath ? root.basePath : '/'}`,
			}))
		} else {
			return undefined
		}
	} else if (root.servers) {
		return root.servers.map(server => ({
			url: server.url,
			description: server.description,
			vendorExtensions: toCodegenVendorExtensions(server),
		}))
	} else {
		return undefined
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

export function processDocument(state: InternalCodegenState): CodegenDocument {
	const operations: CodegenOperation[] = []

	function createCodegenOperation(path: string, method: string, operation: OpenAPI.Operation | undefined, context: CodegenOperationContext) {
		if (!operation) {
			return
		}
	
		const op = toCodegenOperation(path, method, operation, context, state)
		operations.push(op)
	}

	const root = state.root

	/* Process schemas first so we can check for duplicate names when creating new anonymous models */
	const specModels = isOpenAPIV2Document(root) ? root.definitions : root.components?.schemas
	if (specModels) {
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

			toCodegenSchema(reference, true, schemaName, CodegenSchemaPurpose.MODEL, null, state)
		}
	}

	for (const path in root.paths) {
		let pathItem: OpenAPIV2.PathItemObject | OpenAPIV3.PathItemObject = root.paths[path]
		if (!pathItem) {
			continue
		}

		pathItem = resolveReference(pathItem, state)

		const operationContext: CodegenOperationContext = {
			parameters: pathItem.parameters ? toCodegenParameters(pathItem.parameters, undefined, path, state) : undefined,
			summary: isOpenAPIV3PathItemObject(pathItem, state.specVersion) ? pathItem.summary : undefined,
			description: isOpenAPIV3PathItemObject(pathItem, state.specVersion) ? pathItem.description : undefined,
		}
		
		createCodegenOperation(path, HttpMethods.GET, pathItem.get, operationContext)
		createCodegenOperation(path, HttpMethods.PUT, pathItem.put, operationContext)
		createCodegenOperation(path, HttpMethods.POST, pathItem.post, operationContext)
		createCodegenOperation(path, HttpMethods.DELETE, pathItem.delete, operationContext)
		createCodegenOperation(path, HttpMethods.OPTIONS, pathItem.options, operationContext)
		createCodegenOperation(path, HttpMethods.HEAD, pathItem.head, operationContext)
		createCodegenOperation(path, HttpMethods.PATCH, pathItem.patch, operationContext)
		if (isOpenAPIV3PathItemObject(pathItem, state.specVersion)) {
			createCodegenOperation(path, HttpMethods.TRACE, pathItem.trace, operationContext)
		}
	}

	const groups = groupOperations(operations, state)

	const doc: CodegenDocument = {
		info: root.info,
		groups,
		models: state.models,
		servers: toCodegenServers(root),
		securitySchemes: toCodegenSecuritySchemes(state),
		securityRequirements: root.security ? toCodegenSecurityRequirements(root.security, state) : undefined,
	}

	processCodegenDocument(doc, state)
	return doc
}
