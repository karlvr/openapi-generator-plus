import { OpenAPI, OpenAPIV2, OpenAPIV3 } from 'openapi-types'
import { CodegenDocument, CodegenOperation, CodegenResponse, CodegenProperty, CodegenParameter, CodegenMediaType, CodegenVendorExtensions, CodegenModel, CodegenSecurityScheme, CodegenAuthScope as CodegenSecurityScope, CodegenOperationGroup, CodegenServer, CodegenOperationGroups, CodegenNativeType, CodegenTypePurpose, CodegenArrayTypePurpose, CodegenMapTypePurpose, CodegenContent, CodegenParameterIn, CodegenOAuthFlow, CodegenExample, CodegenSecurityRequirement, CodegenPropertyType, CodegenLiteralValueOptions, CodegenTypeInfo, HttpMethods, CodegenDiscriminatorMappings, CodegenDiscriminator, CodegenEnumValue } from '@openapi-generator-plus/types'
import { isOpenAPIV2ResponseObject, isOpenAPIReferenceObject, isOpenAPIV3ResponseObject, isOpenAPIV2GeneralParameterObject, isOpenAPIV2Document, isOpenAPIV3Operation, isOpenAPIV3Document, isOpenAPIV2SecurityScheme, isOpenAPIV3SecurityScheme, isOpenAPIV2ExampleObject, isOpenAPIV3ExampleObject, isOpenAPIv3SchemaObject } from './openapi-type-guards'
import { OpenAPIX } from './types/patches'
import * as _ from 'lodash'
import { stringLiteralValueOptions } from './utils'
import { InternalCodegenState } from './types'

/**
 * Error thrown when a model cannot be generated because it doesn't represent a valid model in
 * the current generator.
 */
export class InvalidModelError extends Error {
	public constructor(message?: string) {
		super(message)
		Object.setPrototypeOf(this, InvalidModelError.prototype)
		this.name = 'InvalidModelError'
	}
}

function groupOperations(operationInfos: CodegenOperation[], state: InternalCodegenState) {
	const strategy = state.generator.operationGroupingStrategy(state)

	const groups: CodegenOperationGroups = {}
	for (const operationInfo of operationInfos) {
		strategy(operationInfo, groups, state)
	}

	return _.values(groups)
}

function processCodegenDocument(doc: CodegenDocument, state: InternalCodegenState) {
	/* Process groups */
	for (const group of doc.groups) {
		processCodegenOperationGroup(group)
	}

	/* Process models */
	doc.models.forEach(model => processCodegenModel(model, state))

	/* Sort groups */
	doc.groups.sort((a, b) => a.name.localeCompare(b.name))

	/* Sort models */
	doc.models.sort((a, b) => a.name.localeCompare(b.name))
}

function processCodegenOperationGroup(group: CodegenOperationGroup) {
	group.operations.sort((a, b) => a.name.localeCompare(b.name))
}

function processCodegenModel(model: CodegenModel, state: InternalCodegenState) {
	if (state.generator.postProcessModel) {
		state.generator.postProcessModel(model, state)
	}
}

/**
 * Collect any anonymous models from the given property so they'll be added to the document.
 * @param property 
 * @param state 
 */
function collectAnonymousModels(models: CodegenModel[] | undefined, state: InternalCodegenState) {
	if (models) {
		state.inlineModels.push(...models)
	}
}

function collectAnonymousModelsFromContents(contents: CodegenContent[] | undefined, state: InternalCodegenState) {
	if (!contents) {
		return
	}

	for (const content of contents) {
		if (content.property) {
			collectAnonymousModels(content.property.models, state)
		}
	}
}

function toCodegenParameter(parameter: OpenAPI.Parameter, scopeNames: string, state: InternalCodegenState): CodegenParameter {
	parameter = resolveReference(parameter, state)

	let property: CodegenProperty | undefined
	let examples: CodegenExample[] | undefined
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
		property = toCodegenProperty(`${scopeNames}_${parameter.name}`, parameter.schema, parameter.required || false, [], state)

		examples = toCodegenExamples(parameter.example, parameter.examples, undefined, state)
	} else if (isOpenAPIV2GeneralParameterObject(parameter, state.specVersion)) {
		property = toCodegenProperty(`${scopeNames}_${parameter.name}`, parameter, parameter.required || false, [], state)
	} else {
		throw new Error(`Cannot resolve schema for parameter: ${JSON.stringify(parameter)}`)
	}

	/* Collect anonymous models as we can't add models to parameters (YET) */
	collectAnonymousModels(property.models, state)

	const result: CodegenParameter = {
		name: parameter.name,

		...extractCodegenTypeInfo(property),

		in: parameter.in as CodegenParameterIn,
		description: parameter.description,
		required: parameter.required,
		collectionFormat: isOpenAPIV2GeneralParameterObject(parameter, state.specVersion) ? parameter.collectionFormat : undefined, // TODO OpenAPI3
		examples,
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

/**
 * Extract _just_ the CodegenTypeInfo properties from the source.
 */
function extractCodegenTypeInfo(source: CodegenTypeInfo): CodegenTypeInfo {
	return {
		type: source.type,
		format: source.format,
		propertyType: source.propertyType,

		nativeType: source.nativeType,
		componentType: source.componentType,
		componentNativeType: source.componentNativeType,

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

	return state.generator.toOperationName(path, method, state)
}

function toCodegenOperation(path: string, method: string, operation: OpenAPI.Operation, state: InternalCodegenState): CodegenOperation {
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
			/* See toCodegenParameter for rationale about scopeNames */
			const requestBodyContents = toCodegenContentArray(`${name}_request`, requestBody.content, [], state)
			if (!requestBodyContents.length) {
				throw new Error(`Request body contents is empty: ${path}`)
			}

			const commonTypes = commonPropertyTypeInfo(requestBodyContents)
			if (!commonTypes) {
				throw new Error(`Cannot find common types for request body contents: ${path}`)
			}
			consumes = findAllContentMediaTypes(requestBodyContents)

			collectAnonymousModelsFromContents(requestBodyContents, state)

			const requestBodyParameter: CodegenParameter = {
				name: 'request',
				in: 'body',

				...commonTypes,

				description: requestBody.description,
				required: requestBody.required,

				examples: collectExamplesFromContents(requestBodyContents),

				isBodyParam: true,

				...extractCodegenTypeInfo(requestBodyContents[0]),
			}

			if (!parameters) {
				parameters = []
			}
			parameters.push(requestBodyParameter)
		}
	} else {
		consumes = toConsumeMediaTypes(operation as OpenAPIV2.OperationObject, state)
	}

	/* Apply special body param properties */
	if (parameters) {
		for (const p of parameters) {
			if (p.isBodyParam) {
				p.consumes = consumes
			}
		}
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
		produces: responses ? toUniqueMediaTypes(responses.reduce((collected, response) => response.produces ? [...collected, ...response.produces] : collected, [] as CodegenMediaType[])) : undefined,
		
		allParams: parameters,
		queryParams: parameters?.filter(p => p.isQueryParam),
		pathParams: parameters?.filter(p => p.isPathParam),
		headerParams: parameters?.filter(p => p.isHeaderParam),
		cookieParams: parameters?.filter(p => p.isCookieParam),
		bodyParam: parameters?.find(p => p.isBodyParam),
		formParams: parameters?.filter(p => p.isFormParam),
		nonBodyParams: parameters?.filter(p => !p.isBodyParam),

		securityRequirements,
		defaultResponse,
		responses,
		deprecated: operation.deprecated,
		summary: operation.summary,
		description: operation.description,
		tags: operation.tags,
		vendorExtensions: toCodegenVendorExtensions(operation),
	}
	op.hasParamExamples = parametersHaveExamples(op.allParams)
	op.hasQueryParamExamples = parametersHaveExamples(op.queryParams)
	op.hasPathParamExamples = parametersHaveExamples(op.pathParams)
	op.hasHeaderParamExamples = parametersHaveExamples(op.headerParams)
	op.hasCookieParamExamples = parametersHaveExamples(op.cookieParams)
	op.hasBodyParamExamples = op.bodyParam ? parametersHaveExamples([op.bodyParam]) : undefined
	op.hasFormParamExamples = parametersHaveExamples(op.formParams)
	op.hasNonBodyParamExamples = parametersHaveExamples(op.nonBodyParams)
	op.hasResponseExamples = responsesHaveExamples(op.responses)
	return op
}

function parametersHaveExamples(parameters: CodegenParameter[] | undefined): boolean | undefined {
	if (!parameters) {
		return undefined
	}

	return !!parameters.find(param => !!param.examples?.length)
}

function responsesHaveExamples(responses: CodegenResponse[] | undefined): boolean | undefined {
	if (!responses) {
		return undefined
	}

	return !!responses.find(response => !!response.examples?.length)
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
			const apiKeyIn: string | undefined = (scheme as any).in // FIXME once openapi-types releases https://github.com/kogosoftwarellc/open-api/commit/1121e63df3aa7bd3dc456825106a668505db0624
			return {
				type: scheme.type,
				description: scheme.description,
				name,
				paramName: (scheme as any).name, // FIXME once openapi-types releases https://github.com/kogosoftwarellc/open-api/commit/1121e63df3aa7bd3dc456825106a668505db0624
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

function toCodegenResponses(operation: OpenAPI.Operation, scopeName: string, state: InternalCodegenState): CodegenResponse[] | undefined {
	const responses = operation.responses
	if (!responses) {
		return undefined
	}

	const result: CodegenResponse[] = []

	let bestCode: number | undefined
	let bestResponse: CodegenResponse | undefined

	for (const responseCodeString in responses) {
		const responseCode = responseCodeString === 'default' ? 0 : parseInt(responseCodeString, 10)
		const response = toCodegenResponse(operation, responseCode, responses[responseCodeString], false, scopeName, state)

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
			const property = toCodegenProperty(`${scopeName}_${code}_response`, response.schema, true, [], state)

			const examples = toCodegenExamples(undefined, response.examples, undefined, state)

			const mediaTypes = toProduceMediaTypes(operation as OpenAPIV2.OperationObject, state)
			contents = mediaTypes ? mediaTypes.map(mediaType => {
				const result: CodegenContent = {
					mediaType,
					property,
					examples: examples?.filter(example => example.mediaType?.mediaType === mediaType.mediaType),
					...extractCodegenTypeInfo(property),
				}
				return result
			}) : undefined
		}
	} else if (isOpenAPIV3ResponseObject(response, state.specVersion)) {
		if (response.content) {
			/* We don't pass scopeNames to toCodegenProperty; see toCodegenParameter for rationale */
			contents = toCodegenContentArray(`${scopeName}_${code}_response`, response.content, [], state)
		}
	} else {
		throw new Error(`Unsupported response: ${JSON.stringify(response)}`)
	}

	/* Determine if there's a common type and nativeType */
	const commonTypes = commonPropertyTypeInfo(contents)
	const produces = findAllContentMediaTypes(contents)

	/** Collect anonymous models as we can't add models to responses (YET) */
	collectAnonymousModelsFromContents(contents, state)

	return {
		code,
		description: response.description,
		isDefault,
		...commonTypes,
		contents,
		produces,
		examples: collectExamplesFromContents(contents),
		vendorExtensions: toCodegenVendorExtensions(response),

		...(contents && contents.length ? extractCodegenTypeInfo(contents[0]) : {}),
	}
}

type OpenAPIV3Examples = { [name: string]: OpenAPIV3.ReferenceObject | OpenAPIV3.ExampleObject }

function toCodegenExamples(example: any | undefined, examples: OpenAPIV2.ExampleObject | OpenAPIV3Examples | undefined, mediaType: string | undefined, state: InternalCodegenState): CodegenExample[] | undefined {
	if (example) {
		return [{
			value: example,
			valueString: toCodegenExampleValueString(example, mediaType, state),
			valuePretty: toCodegenExampleValuePretty(example),
		}]
	}

	if (!examples) {
		return undefined
	}

	const result: CodegenExample[] = []
	for (const mediaTypeOrName in examples) {
		const example = examples[mediaTypeOrName]
		if (isOpenAPIV2ExampleObject(example, state.specVersion)) {
			result.push({
				mediaType: toCodegenMediaType(mediaTypeOrName),
				value: example,
				valueString: toCodegenExampleValueString(example, mediaTypeOrName, state),
				valuePretty: toCodegenExampleValuePretty(example),
			})
		} else if (isOpenAPIV3ExampleObject(example, state.specVersion)) {
			const value = example.value || example.externalValue // TODO handle externalValue
			result.push({
				name: mediaTypeOrName,
				mediaType: toCodegenMediaType(mediaType!),
				description: example.description,
				summary: example.summary,
				value,
				valueString: toCodegenExampleValueString(example, mediaType, state),
				valuePretty: toCodegenExampleValuePretty(example),
			})
		} else {
			throw new Error(`Unsupported spec version: ${state.specVersion}`)
		}
	}

	return result
}

function toCodegenExampleValueString(value: any, mediaType: string | undefined, state: InternalCodegenState) {
	if (typeof value === 'string') {
		return state.generator.toLiteral(value, stringLiteralValueOptions(state), state)
	} else {
		// TODO we're assuming that we're transforming an object to JSON, which is appropriate is the mediaType is JSON
		const stringValue = JSON.stringify(value)
		return state.generator.toLiteral(stringValue, stringLiteralValueOptions(state), state)
	}
}

function toCodegenExampleValuePretty(value: any) {
	if (typeof value === 'string') {
		return value
	} else {
		// TODO we're assuming that we're transforming an object to JSON, which is appropriate is the mediaType is JSON
		return JSON.stringify(value, undefined, 4)
	}
}

function collectExamplesFromContents(contents: CodegenContent[] | undefined): CodegenExample[] | undefined {
	if (!contents) {
		return undefined
	}

	const result = contents?.reduce((collected, content) => content.examples ? [...collected, ...content.examples] : collected, [] as CodegenExample[])
	if (!result.length) {
		return undefined
	}

	return result
}

/**
 * Finds the common property type info from the array of CodegenContent, or returns `undefined` if there
 * is no common property type info.
 */
function commonPropertyTypeInfo(contents: CodegenContent[] | undefined): CodegenTypeInfo | undefined {
	if (!contents || !contents.length) {
		return undefined
	}

	let result: CodegenTypeInfo | undefined
	
	for (const content of contents) {
		if (!result) {
			result = {
				type: content.property.type,
				format: content.property.format,
				propertyType: content.property.propertyType,
				nativeType: content.property.nativeType,
				componentType: content.property.componentType,
				componentNativeType: content.property.componentNativeType,
			}
		} else {
			if (content.property.type !== result.type) {
				return undefined
			}
			if (content.property.format !== result.format) {
				return undefined
			}
			if (content.property.nativeType !== result.nativeType) {
				return undefined
			}
			if (content.property.componentType !== result.componentType) {
				return undefined
			}
			if (content.property.componentNativeType !== result.componentNativeType) {
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

function toCodegenContentArray(name: string, content: { [media: string]: OpenAPIV3.MediaTypeObject }, scopeNames: string[], state: InternalCodegenState): CodegenContent[] {
	const result: CodegenContent[] = []
	for (const mediaType in content) {
		const mediaTypeContent = content[mediaType]

		const examples: CodegenExample[] | undefined = toCodegenExamples(mediaTypeContent.example, mediaTypeContent.examples, mediaType, state)

		if (!mediaTypeContent.schema) {
			throw new Error('Media type content without a schema')
		}
		const property = toCodegenProperty(name, mediaTypeContent.schema, true, scopeNames, state)
		
		const item: CodegenContent = {
			mediaType: toCodegenMediaType(mediaType),
			property,
			examples,
			...extractCodegenTypeInfo(property),
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

function toCodegenProperty(name: string, schema: OpenAPIX.SchemaObject, required: boolean, scopeNames: string[], state: InternalCodegenState): CodegenProperty {
	/* The name of the schema, which can be used to name custom types */
	const refName = isOpenAPIReferenceObject(schema) ? nameFromRef(schema.$ref) : undefined
	
	let type: string
	let format: string | undefined
	let nativeType: CodegenNativeType
	let models: CodegenModel[] | undefined
	let componentProperty: CodegenProperty | undefined
	let propertyType: CodegenPropertyType

	/* Grab the description before resolving refs, so we preserve the property description even if it references an object. */
	let description = (schema as OpenAPIV2.SchemaObject).description

	const originalSchema = schema
	schema = resolveReference(schema, state)

	if (isModelSchema(schema, state)) {
		const model = toCodegenModel(name, scopeNames, originalSchema, state)
		type = model.type
		format = model.format
		nativeType = model.propertyNativeType
		if (!refName) {
			models = [model]
		}
		propertyType = model.propertyType
	} else {
		if (schema.type === 'array') {
			if (!schema.items) {
				throw new Error('items missing for schema type "array"')
			}
			type = schema.type
	
			/* Component properties are implicitly required as we don't expect to have `null` entries in the array. */
			componentProperty = toCodegenProperty(name, schema.items, true, refName ? [refName] : scopeNames, state)
			nativeType = state.generator.toNativeArrayType({
				componentNativeType: componentProperty.nativeType,
				required,
				uniqueItems: schema.uniqueItems,
				modelNames: refName ? [refName] : undefined,
				purpose: CodegenArrayTypePurpose.PROPERTY,
			}, state)
			models = componentProperty.models
			propertyType = CodegenPropertyType.ARRAY
		} else if (typeof schema.type === 'string') {
			type = schema.type
			format = schema.format
			nativeType = state.generator.toNativeType({
				type,
				format,
				required,
				purpose: CodegenTypePurpose.PROPERTY,
			}, state)
			propertyType = toCodegenPropertyType(type, format, false, false)
		} else {
			throw new Error(`Unsupported schema type "${schema.type}" for property in ${JSON.stringify(schema)}`)
		}
	}

	if (!description) {
		description = schema.description
	}

	const property: CodegenProperty = {
		name,
		description,
		title: schema.title,
		readOnly: schema.readOnly !== undefined ? !!schema.readOnly : undefined,
		required,
		vendorExtensions: toCodegenVendorExtensions(schema),

		type,
		format: schema.format,
		propertyType,
		nativeType,

		componentType: componentProperty && componentProperty.type,
		componentNativeType: componentProperty && componentProperty.nativeType,

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

		models,
	}

	if (isOpenAPIv3SchemaObject(schema, state.specVersion)) {
		property.nullable = schema.nullable
		property.writeOnly = schema.writeOnly
		property.deprecated = schema.deprecated
	}

	property.defaultValue = state.generator.toDefaultValue(schema.default, property, state)
	return property
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
function fullyQualifiedModelName(name: string, scopeNames: string[] | undefined): string {
	return scopeNames && scopeNames.length ? `${scopeNames.join('.')}.${name}` : name
}

/**
 * Returns a unique model name for a proposed model name.
 * @param proposedName the proposed model name
 * @param scopeNames the enclosing model names, if any
 * @param state the state
 */
function uniqueModelName(proposedName: string, scopeNames: string[] | undefined, state: InternalCodegenState): string {
	if (!state.usedModelFullyQualifiedNames[fullyQualifiedModelName(proposedName, scopeNames)]) {
		return proposedName
	}

	let name = proposedName
	let iteration = 0
	do {
		iteration += 1
		name = state.generator.toIteratedModelName(proposedName, scopeNames, iteration, state)
	} while (state.usedModelFullyQualifiedNames[fullyQualifiedModelName(name, scopeNames)])

	return name
}

function toCodegenModelProperties(schema: OpenAPIX.SchemaObject, scopeNames: string[], state: InternalCodegenState): CodegenProperty[] | undefined {
	schema = resolveReference(schema, state)

	if (typeof schema.properties !== 'object') {
		return undefined
	}

	const properties: CodegenProperty[] = []
	for (const propertyName in schema.properties) {
		const required = typeof schema.required === 'object' ? schema.required.indexOf(propertyName) !== -1 : false
		const propertySchema = schema.properties[propertyName]
		const property = toCodegenProperty(propertyName, propertySchema, required, scopeNames, state)
		properties.push(property)
	}

	return properties
}

function isModelSchema(schema: OpenAPIX.SchemaObject, state: InternalCodegenState): boolean {
	const resolvedSchema = resolveReference(schema, state)

	return (resolvedSchema.enum || resolvedSchema.type === 'object' ||
		resolvedSchema.allOf || resolvedSchema.anyOf || resolvedSchema.oneOf)
}

function toCodegenModel(name: string, scopeNames: string[] | undefined, schema: OpenAPIX.SchemaObject, state: InternalCodegenState): CodegenModel {
	const $ref = isOpenAPIReferenceObject(schema) ? schema.$ref : undefined

	/* Check if we've already generated this model, and return it */
	const existing = $ref && state.modelsByRef[$ref]
	if (existing) {
		return existing
	}

	if ($ref) {
		const refName = nameFromRef($ref)
		if (refName) {
			name = refName
			scopeNames = undefined
		}
	} else {
		if (schema.enum) {
			name = state.generator.toEnumName(name, state)
		} else {
			name = state.generator.toModelNameFromPropertyName(name, state)
		}
	}
	
	schema = resolveReference(schema, state)

	const vendorExtensions = toCodegenVendorExtensions(schema)

	/* Support vendor extension to override the automatic naming of models */
	if (vendorExtensions && vendorExtensions['x-model-name']) {
		name = vendorExtensions['x-model-name']
	}

	const reservedName = $ref && state.reservedNames[$ref]
	if (reservedName !== fullyQualifiedModelName(name, scopeNames)) {
		/* Model types that aren't defined in the spec need to be made unique */
		name = uniqueModelName(name, scopeNames, state)
	}

	const nativeType = state.generator.toNativeObjectType({
		purpose: CodegenTypePurpose.MODEL,
		modelNames: scopeNames ? [...scopeNames, name] : [name],
	}, state)

	const propertyNativeType = state.generator.toNativeObjectType({
		purpose: CodegenTypePurpose.PROPERTY,
		modelNames: scopeNames ? [...scopeNames, name] : [name],
	}, state)

	const isEnum = !!schema.enum
	const model: CodegenModel = {
		name,
		description: schema.description,
		vendorExtensions,
		nativeType,
		propertyNativeType,
		type: 'object',
		propertyType: isEnum ? CodegenPropertyType.ENUM : CodegenPropertyType.OBJECT,
	}

	if (isOpenAPIv3SchemaObject(schema, state.specVersion)) {
		model.deprecated = schema.deprecated
	}

	/* Add to known models */
	state.usedModelFullyQualifiedNames[fullyQualifiedModelName(name, scopeNames)] = true
	if ($ref) {
		state.modelsByRef[$ref] = model
	}

	const nestedParentNames = scopeNames ? [...scopeNames, name] : [name]

	model.properties = toCodegenModelProperties(schema, nestedParentNames, state)

	function absorbSchema(otherSchema: OpenAPIX.SchemaObject) {
		/* We absorb the properties from the other model as if they were our own, so we name
		   any inline models as if they were inline inside us rather than `otherSchema`, which
		   may be an inline model that will never exist.
		 */
		const otherProperties = toCodegenModelProperties(otherSchema, nestedParentNames, state)
		if (otherProperties) {
			if (!model.properties) {
				model.properties = []
			}
			model.properties.push(...otherProperties)
		}

		/* Make a model and return it so we can access metadata about the model; noting that this model may never exist */
		return toCodegenModel('InlineModel', nestedParentNames, otherSchema, state)
	}

	if (schema.allOf) {
		const allOf = schema.allOf as Array<OpenAPIX.SchemaObject>

		/* We support single parent inheritance, so check if that's possible */
		if (allOf.length) {
			const possibleParentSchema = allOf[0]
			if (isOpenAPIReferenceObject(possibleParentSchema)) {
				const parentModel = toCodegenModel(name, scopeNames, possibleParentSchema, state)

				model.parent = parentModel
				model.parentNativeType = parentModel.nativeType

				allOf.shift()
			}
		}

		for (const otherSchema of allOf) {
			const otherModel = absorbSchema(otherSchema)
			if (otherModel.discriminator) {
				/* otherModel has a discriminator so we need to add ourselves as a subtype, and now otherModel must be an interface!!!  */
				if (!model.properties) {
					throw new Error(`Model "${nativeType}", with allOf parent "${otherModel.nativeType}" with discriminator, doesn't have properties.`)
				}
				const otherDiscriminatorProperty = removeModelProperty(model.properties, otherModel.discriminator.name)
				if (!otherDiscriminatorProperty) {
					throw new Error(`Discriminator property "${otherModel.discriminator.name}" from "${otherModel.nativeType}" missing from "${nativeType}"`)
				}

				const discriminatorValue = $ref && otherModel.discriminator.mappings && otherModel.discriminator.mappings[$ref] ? otherModel.discriminator.mappings[$ref] : name
				otherModel.discriminator.references.push({
					model,
					name: discriminatorValue,
				})
				if (!model.discriminatorValues) {
					model.discriminatorValues = []
				}
				model.discriminatorValues.push({
					discriminator: otherModel.discriminator,
					value: state.generator.toLiteral(discriminatorValue, otherModel.discriminator, state),
				})
			}
		}
	} else if (schema.anyOf) {
		// const anyOf = schema.anyOf as Array<OpenAPIX.SchemaObject>
		// for (const subSchema of anyOf) {
		// 	absorbSubSchema(subSchema)
		// }
		throw new Error('anyOf not yet supported')
	} else if (schema.oneOf) {
		const oneOf = schema.oneOf as Array<OpenAPIX.SchemaObject>
		if (schema.discriminator) {
			const schemaDiscriminator = schema.discriminator as OpenAPIV3.DiscriminatorObject
			const mappings = toCodegenDiscriminatorMappings(schemaDiscriminator)
			model.discriminator = {
				name: schemaDiscriminator.propertyName,
				mappings,
				references: [],
				type: 'string',
				propertyType: CodegenPropertyType.STRING,
				nativeType: state.generator.toNativeType({ type: 'string', required: true, purpose: CodegenTypePurpose.DISCRIMINATOR }, state),
			}
			
			for (const subSchema of oneOf) {
				const subModel = toCodegenModel(name, scopeNames, subSchema, state)
				const subModelDiscriminatorProperty = removeModelProperty(subModel, schemaDiscriminator.propertyName)
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
					discriminator: model.discriminator,
					value: state.generator.toLiteral(discriminatorValue, model.discriminator, state),
				})
			}
		} else {
			/* Without a discriminator we just bundle them all together into one object and let the user work it out */
			for (const subSchema of oneOf) {
				absorbSchema(subSchema)
			}
		}
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
		const enumValuePropertyType = toCodegenPropertyType(enumValueType, enumValueFormat, false, false)

		const enumValueNativeType = state.generator.toNativeType({
			type,
			format: schema.format,
			purpose: CodegenTypePurpose.ENUM,
		}, state)

		const enumValueLiteralOptions: CodegenLiteralValueOptions = {
			type: enumValueType,
			format: enumValueFormat,
			propertyType: enumValuePropertyType,
			nativeType: enumValueNativeType,
		}
		
		const enumValues: CodegenEnumValue[] | undefined = schema.enum ? schema.enum.map(name => ({
			name: state.generator.toEnumMemberName(name, state),
			literalValue: state.generator.toLiteral(name, enumValueLiteralOptions, state),
		})) : undefined

		if (enumValues) {
			model.enumValueNativeType = enumValueNativeType
			model.enumValues = enumValues
		}
	} else if (schema.type === 'array') {
		if (!schema.items) {
			throw new Error('items missing for schema type "array"')
		}

		const componentProperty = toCodegenProperty(name, schema.items, true, [], state)
		model.parentNativeType = state.generator.toNativeArrayType({
			componentNativeType: componentProperty.nativeType,
			uniqueItems: schema.uniqueItems,
			purpose: CodegenArrayTypePurpose.PARENT,
		}, state)
	} else if (schema.type === 'object') {
		if (schema.additionalProperties) {
			const keyNativeType = state.generator.toNativeType({
				type: 'string',
				purpose: CodegenTypePurpose.KEY,
			}, state)
			const componentProperty = toCodegenProperty(name, schema.additionalProperties, true, [], state)

			model.parentNativeType = state.generator.toNativeMapType({
				keyNativeType,
				componentNativeType: componentProperty.nativeType,
				purpose: CodegenMapTypePurpose.PARENT,
			}, state)
		} else if (schema.discriminator) {
			/* Object has a discriminator so all submodels will need to add themselves */
			const schemaDiscriminator = schema.discriminator as OpenAPIV3.DiscriminatorObject

			if (!model.properties) {
				throw new Error(`Model "${nativeType}" with discriminator doesn't have properties.`)
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
		/* Other types aren't represented as models, they are just inline type definitions like a string with a format */
		throw new InvalidModelError()
	}

	/* Add child model */
	if (model.parent) {
		if (!model.parent.children) {
			model.parent.children = []
		}
		model.parent.children.push(model)

		const discriminator = findDiscriminator(model.parent)
		if (discriminator) {
			const discriminatorValue = ($ref && findDiscriminatorMapping(discriminator, $ref)) || model.name
			if (!model.discriminatorValues) {
				model.discriminatorValues = []
			}
			model.discriminatorValues.push({
				discriminator,
				value: state.generator.toLiteral(discriminatorValue, discriminator, state),
			})
			discriminator.references.push({
				model,
				name: discriminatorValue,
			})
		}
	}

	/* Collect models from properties */
	function collectModels(properties: CodegenProperty[] | undefined): CodegenModel[] | undefined {
		if (!properties) {
			return undefined
		}

		const models: CodegenModel[] = []
		for (const property of properties) {
			if (property.models) {
				models.push(...property.models)
			}
		}
		if (models.length) {
			return models
		} else {
			return undefined
		}
	}

	model.models = collectModels(model.properties)

	return model
}

function findDiscriminatorMapping(discriminator: CodegenDiscriminator, ref: string): string | undefined {
	if (discriminator.mappings) {
		return discriminator.mappings[ref]
	} else {
		return undefined
	}
}

function findDiscriminator(model: CodegenModel): CodegenDiscriminator | undefined {
	if (model.discriminator) {
		return model.discriminator
	} else if (model.parent) {
		return findDiscriminator(model.parent)
	} else {
		return undefined
	}
}

function findModelProperty(model: CodegenModel, name: string): CodegenProperty | undefined {
	return model.properties && model.properties.find(p => p.name === name)
}

function removeModelProperty(model: CodegenModel, name: string): CodegenProperty | undefined
function removeModelProperty(properties: CodegenProperty[], name: string): CodegenProperty | undefined
function removeModelProperty(modelOrProperties: CodegenModel | CodegenProperty[], name: string): CodegenProperty | undefined {
	const properties = Array.isArray(modelOrProperties) ? modelOrProperties : modelOrProperties.properties
	if (!properties) {
		return undefined
	}

	const index = properties.findIndex(p => p.name === name)
	if (index === -1) {
		return undefined
	}

	return properties.splice(index, 1)[0]
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
	} else {
		return root.servers
	}
}

export function processDocument(state: InternalCodegenState): CodegenDocument {
	const operations: CodegenOperation[] = []

	function createCodegenOperation(path: string, method: string, operation: OpenAPI.Operation | undefined) {
		if (!operation) {
			return
		}
	
		const op = toCodegenOperation(path, method, operation, state)
		operations.push(op)
	}

	const root = state.root

	function refForSchemaName(schemaName: string): string {
		return isOpenAPIV2Document(root) ? `#/definitions/${schemaName}` : `#/components/schemas/${schemaName}`
	}

	/* Process models first so we can check for duplicate names when creating new anonymous models */
	const specModels = isOpenAPIV2Document(root) ? root.definitions : root.components?.schemas
	const models: CodegenModel[] = []
	if (specModels) {
		/* Collect defined schema names first, so no inline or external models can use those names */
		for (const schemaName in specModels) {
			const fqmn = fullyQualifiedModelName(schemaName, undefined)
			state.usedModelFullyQualifiedNames[fqmn] = true
			state.reservedNames[refForSchemaName(schemaName)] = fqmn
		}

		for (const schemaName in specModels) {
			/* We load the model using a reference as we use references to distinguish between explicit and inline models */
			const reference: OpenAPIX.ReferenceObject = {
				$ref: refForSchemaName(schemaName),
			}
			try {
				const model = toCodegenModel(schemaName, undefined, reference, state)
				models.push(model)
			} catch (error) {
				if (error instanceof InvalidModelError || error.name === 'InvalidModelError') {
					/* Ignoring invalid model. We don't need to generate invalid models, they are not intended to be generated */
				} else {
					throw error
				}
			}
		}
	}

	for (const path in root.paths) {
		const pathItem: OpenAPIV2.PathItemObject | OpenAPIV3.PathItemObject = root.paths[path]
		if (!pathItem) {
			continue
		}
		
		createCodegenOperation(path, HttpMethods.DELETE, pathItem.delete)
		createCodegenOperation(path, HttpMethods.GET, pathItem.get)
		createCodegenOperation(path, HttpMethods.HEAD, pathItem.head)
		createCodegenOperation(path, HttpMethods.OPTIONS, pathItem.options)
		createCodegenOperation(path, HttpMethods.PATCH, pathItem.patch)
		createCodegenOperation(path, HttpMethods.POST, pathItem.post)
		createCodegenOperation(path, HttpMethods.PUT, pathItem.put)
	}

	const groups = groupOperations(operations, state)

	/* Add in the inline models */
	models.push(...state.inlineModels)

	const doc: CodegenDocument = {
		info: root.info,
		groups,
		models,
		servers: toCodegenServers(root),
		securitySchemes: toCodegenSecuritySchemes(state),
		securityRequirements: root.security ? toCodegenSecurityRequirements(root.security, state) : undefined,
	}

	processCodegenDocument(doc, state)
	return doc
}
