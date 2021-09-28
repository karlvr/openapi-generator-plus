import { CodegenAuthScope, CodegenOAuthFlow, CodegenSecurityRequirements, CodegenSecurityRequirementScheme, CodegenSecurityScheme } from '@openapi-generator-plus/types'
import { OpenAPIV2, OpenAPIV3 } from 'openapi-types'
import { isOpenAPIV2Document, isOpenAPIV2SecurityScheme, isOpenAPIV3Document, isOpenAPIV3SecurityScheme } from '../openapi-type-guards'
import { InternalCodegenState } from '../types'
import { resolveReference } from './utils'
import { toCodegenVendorExtensions } from './vendor-extensions'

export function toCodegenSecuritySchemes(state: InternalCodegenState): CodegenSecurityScheme[] | null {
	if (isOpenAPIV2Document(state.root)) {
		if (!state.root.securityDefinitions) {
			return null
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
			return null
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

export function toCodegenSecurityRequirements(security: OpenAPIV2.SecurityRequirementObject[] | OpenAPIV3.SecurityRequirementObject[], state: InternalCodegenState): CodegenSecurityRequirements | undefined {
	const result: CodegenSecurityRequirements = {
		optional: false,
		requirements: [],
	}
	for (const securityElement of security) {
		const schemes: CodegenSecurityRequirementScheme[] = []
		for (const name in securityElement) {
			schemes.push(toCodegenSecurityRequirementScheme(name, securityElement[name], state))
		}
		if (schemes.length === 0) {
			/* See the note on `security` field at https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.3.md#operation-object */
			result.optional = true
		} else {
			result.requirements.push({
				schemes,
			})
		}
	}
	if (result.requirements.length === 0) {
		return undefined
	}

	return result
}

function toCodegenSecurityRequirementScheme(name: string, scopes: string[], state: InternalCodegenState): CodegenSecurityRequirementScheme {
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
	let scopeObjects: CodegenAuthScope[] | undefined

	if (scopes && scheme.flows) {
		scopeObjects = []
		for (const scope of scopes) {
			const scopeObject = findSecurityScope(scope, scheme)
			if (scopeObject) {
				scopeObjects.push(scopeObject)
			} else {
				scopeObjects.push({
					name: scope,
					description: null,
					vendorExtensions: null,
				})
			}
		}
	}

	return {
		scheme,
		scopes: scopeObjects || null,
	}
}

function findSecurityScope(scope: string, scheme: CodegenSecurityScheme): CodegenAuthScope | undefined {
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

const DEFAULT_SECURITY_SCHEME: Omit<CodegenSecurityScheme, 'name' | 'type' | 'vendorExtensions'> = {
	description: null,
	paramName: null,
	in: null,
	scheme: null,
	flows: null,
	openIdConnectUrl: null,
	isBasic: false,
	isHttp: false,
	isApiKey: false,
	isOAuth: false,
	isOpenIdConnect: false,
	isInQuery: false,
	isInHeader: false,
}

function toCodegenSecurityScheme(name: string, scheme: OpenAPIV2.SecuritySchemeObject | OpenAPIV3.SecuritySchemeObject, state: InternalCodegenState): CodegenSecurityScheme {
	const type = scheme.type
	switch (type) {
		case 'basic':
			return {
				...DEFAULT_SECURITY_SCHEME,
				type: 'http',
				description: scheme.description || null,
				name,
				scheme: 'basic',
				isBasic: true,
				isHttp: true,
				vendorExtensions: toCodegenVendorExtensions(scheme),
			}
		case 'http':
			return {
				...DEFAULT_SECURITY_SCHEME,
				type: scheme.type,
				description: scheme.description || null,
				name,
				scheme: scheme.scheme,
				isBasic: scheme.scheme ? scheme.scheme.toLowerCase() === 'basic' : false,
				isHttp: true,
				vendorExtensions: toCodegenVendorExtensions(scheme),
			}
		case 'apiKey': {
			const apiKeyIn: string | undefined = scheme.in
			if (apiKeyIn !== 'header' && apiKeyIn !== 'query' && apiKeyIn !== 'cookie') {
				throw new Error(`Unsupported API key security "in" value "${apiKeyIn}`)
			}
			return {
				...DEFAULT_SECURITY_SCHEME,
				type: scheme.type,
				description: scheme.description || null,
				name,
				paramName: scheme.name,
				in: apiKeyIn,
				isApiKey: true,
				isInHeader: apiKeyIn === 'header',
				isInQuery: apiKeyIn === 'query',
				vendorExtensions: toCodegenVendorExtensions(scheme),
			}
		}
		case 'oauth2': {
			let flows: CodegenOAuthFlow[] | null
			if (isOpenAPIV2SecurityScheme(scheme, state.specVersion)) {
				flows = [{
					type: scheme.flow,
					authorizationUrl: scheme.flow === 'implicit' || scheme.flow === 'accessCode' ? scheme.authorizationUrl : null,
					tokenUrl: scheme.flow === 'password' || scheme.flow === 'application' || scheme.flow === 'accessCode' ? scheme.tokenUrl : null,
					refreshUrl: null,
					scopes: toCodegenAuthScopes(scheme.scopes),
					vendorExtensions: null,
				}]
			} else if (isOpenAPIV3SecurityScheme(scheme, state.specVersion)) {
				flows = toCodegenOAuthFlows(scheme)
			} else {
				flows = null
			}
			return {
				...DEFAULT_SECURITY_SCHEME,
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
				...DEFAULT_SECURITY_SCHEME,
				type: scheme.type,
				description: scheme.description || null,
				name,
				openIdConnectUrl: scheme.openIdConnectUrl,
				isOpenIdConnect: true,
				vendorExtensions: toCodegenVendorExtensions(scheme),
			}
		default:
			throw new Error(`Unsupported security scheme type: ${type}`)
	}
}

function toCodegenOAuthFlows(scheme: OpenAPIV3.OAuth2SecurityScheme): CodegenOAuthFlow[] | null {
	const result: CodegenOAuthFlow[] = []
	if (scheme.flows.implicit) {
		result.push({
			type: 'implicit',
			authorizationUrl: scheme.flows.implicit.authorizationUrl,
			tokenUrl: null,
			refreshUrl: scheme.flows.implicit.refreshUrl || null,
			scopes: toCodegenAuthScopes(scheme.flows.implicit.scopes),
			vendorExtensions: toCodegenVendorExtensions(scheme.flows.implicit),
		})
	}
	if (scheme.flows.password) {
		result.push({
			type: 'password',
			authorizationUrl: null,
			tokenUrl: scheme.flows.password.tokenUrl,
			refreshUrl: scheme.flows.password.refreshUrl || null,
			scopes: toCodegenAuthScopes(scheme.flows.password.scopes),
			vendorExtensions: toCodegenVendorExtensions(scheme.flows.password),
		})
	}
	if (scheme.flows.authorizationCode) {
		result.push({
			type: 'authorizationCode',
			authorizationUrl: scheme.flows.authorizationCode.authorizationUrl,
			tokenUrl: scheme.flows.authorizationCode.tokenUrl,
			refreshUrl: scheme.flows.authorizationCode.refreshUrl || null,
			scopes: toCodegenAuthScopes(scheme.flows.authorizationCode.scopes),
			vendorExtensions: toCodegenVendorExtensions(scheme.flows.authorizationCode),
		})
	}
	if (scheme.flows.clientCredentials) {
		result.push({
			type: 'clientCredentials',
			authorizationUrl: null,
			tokenUrl: scheme.flows.clientCredentials.tokenUrl,
			refreshUrl: scheme.flows.clientCredentials.refreshUrl || null,
			scopes: toCodegenAuthScopes(scheme.flows.clientCredentials.scopes),
			vendorExtensions: toCodegenVendorExtensions(scheme.flows.clientCredentials),
		})
	}
	if (result.length === 0) {
		return null
	}
	return result
}

function toCodegenAuthScopes(scopes: OpenAPIV2.ScopesObject): CodegenAuthScope[] | null {
	const vendorExtensions = toCodegenVendorExtensions(scopes)

	/* A bug in the swagger parser? The openapi-types don't suggest that scopes should be an array */
	if (Array.isArray(scopes)) {
		scopes = scopes[0]
	}

	const result: CodegenAuthScope[] = []
	for (const name in scopes) {
		const scopeDescription = scopes[name]
		result.push({
			name: name,
			description: scopeDescription,
			vendorExtensions,
		})
	}

	if (result.length === 0) {
		return null
	}
	return result
}
