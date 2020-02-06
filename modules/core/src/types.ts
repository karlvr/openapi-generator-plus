import { OpenAPI } from 'openapi-types'
import SwaggerParser = require('swagger-parser')

export interface CodegenState {
	parser: SwaggerParser
	root: OpenAPI.Document
	config: CodegenConfig
	options: CodegenOptions
	anonymousModels: { [name: string]: CodegenModel }
}

export interface CodegenInitialOptions {
	[name: string]: any
}

export interface CodegenConfig {
	toClassName: (name: string, state: CodegenState) => string
	toIdentifier: (name: string, state: CodegenState) => string
	toConstantName: (name: string, state: CodegenState) => string
	toEnumName: (name: string, state: CodegenState) => string
	toOperationName: (path: string, method: string, state: CodegenState) => string

	/** Format a value as a literal in the language */
	toLiteral: (value: any, type: string, format: string | undefined, required: boolean, state: CodegenState) => string
	toNativeType: (type: string, format: string | undefined, required: boolean, modelNames: string[] | undefined, state: CodegenState) => string
	toNativeArrayType: (componentNativeType: string, required: boolean, uniqueItems: boolean | undefined, state: CodegenState) => string
	toNativeMapType: (keyNativeType: string, componentNativeType: string, state: CodegenState) => string
	/** Return the default value to use for a property as a literal in the language */
	toDefaultValue: (defaultValue: any, type: string, format: string | undefined, required: boolean, state: CodegenState) => string
	options: (initialOptions: CodegenInitialOptions) => CodegenOptions

	exportTemplates: (doc: CodegenDocument, commandLineOptions: any, state: CodegenState) => void
}

/**
 * Options that the user can provide to the code generation process.
 */
export interface CodegenOptions {
	hideGenerationTimestamp?: boolean
}

/**
 * Code generation specific context attributes that are added to the root context.
 */
export interface CodegenRootContext {
	generatorClass: string
	generatedDate: string
}

export interface CodegenDocument {
	groups: CodegenOperationGroup[]
	models: CodegenModel[]
}

export interface CodegenOperationGroup {
	name: string
	path: string
	
	operations: CodegenOperation[]
	consumes?: CodegenMediaType[] // TODO in OpenAPIV2 these are on the document, but not on OpenAPIV3
	produces?: CodegenMediaType[] // TODO in OpenAPIV2 these are on the document, but not on OpenAPIV3
}

export interface CodegenOperation {
	name: string
	httpMethod: string
	path: string
	returnType?: string
	returnNativeType?: string
	consumes?: CodegenMediaType[] // TODO in OpenAPIV2 these are on the document, but not on OpenAPIV3
	produces?: CodegenMediaType[] // TODO in OpenAPIV2 these are on the document, but not on OpenAPIV3
	allParams?: CodegenParameter[]
	authMethods?: CodegenAuthMethod[]
	vendorExtensions?: CodegenVendorExtensions
	responses?: CodegenResponse[]
	defaultResponse?: CodegenResponse
	isDeprecated?: boolean
	summary?: string
	description?: string
	tags?: string[]
}

export interface CodegenResponse {
	code: number
	description: string // TODO called message in swagger-codegen
	// schema?: CodegenProperty
	type?: string
	containerType?: string // TODO what is this?
	isDefault: boolean
	vendorExtensions?: CodegenVendorExtensions
	nativeType?: string
}

/* See DefaultCodegen.fromProperty */
export interface CodegenProperty {
	name: string
	description?: string
	title?: string
	exampleValue?: string
	defaultValue?: string
	readOnly: boolean
	required: boolean
	vendorExtensions?: CodegenVendorExtensions

	/** OpenAPI type */
	type: string

	/** Type in native language */
	nativeType: string

	/* Validation */
	maximum?: number
	exclusiveMaximum?: boolean
	minimum?: number
	exclusiveMinimum?: boolean
	maxLength?: number
	minLength?: number
	pattern?: string
	maxItems?: number
	minItems?: number
	uniqueItems?: boolean
	multipleOf?: number
	
	isObject: boolean
	isArray: boolean
	isBoolean: boolean
	isNumber: boolean
	isEnum: boolean

	/** Nested models */
	models?: CodegenModel[]
}

/** The context for model output */
export interface CodegenModelContext {
	model: CodegenModel[]
}

export interface CodegenModel {
	name: string
	description?: string
	vars: CodegenProperty[]
	vendorExtensions?: CodegenVendorExtensions

	/** Enums */
	isEnum: boolean
	/** The native type of the enum value */
	enumValueNativeType?: string
	/** The values making up the enum */
	enumValues?: CodegenEnumValue[]

	/** Nested models */
	models?: CodegenModel[]
}

export interface CodegenEnumValue {
	value: any
	literalValue: string
}

export interface CodegenParameter {
	name: string
	in: string
	type?: string
	nativeType?: string
	description?: string
	required?: boolean

	isQueryParam?: boolean
	isPathParam?: boolean
	isHeaderParam?: boolean
	isCookieParam?: boolean
	isBodyParam?: boolean
	isFormParam?: boolean
}

export interface CodegenVendorExtensions {
	[name: string]: any
}

export interface CodegenAuthMethod {
	type: string
	description?: string
	name: string

	/** The header or query parameter name for apiKey */
	paramName?: string
	in?: string
	
	flow?: string
	authorizationUrl?: string
	tokenUrl?: string
	scopes?: CodegenAuthScope[]

	isBasic?: boolean
	isApiKey?: boolean
	isOAuth?: boolean

	isInQuery?: boolean
	isInHeader?: boolean

	vendorExtensions?: CodegenVendorExtensions
}

export interface CodegenAuthScope {
	scope: string
	description?: string
	
	vendorExtensions?: CodegenVendorExtensions
}

export interface CodegenMediaType {
	mediaType: string

	// TODO OpenAPIV3
}
