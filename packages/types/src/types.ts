import { OpenAPI } from 'openapi-types'

export interface CodegenInputDocument {
	$refs: {
		get: <T>(name: string) => T
	}
	root: OpenAPI.Document
}

export interface CodegenState<O = {}> {
	generator: CodegenGenerator<O>
	options: O
}

/**
 * The interface implemented by language-specific generator modules.
 */
export interface CodegenGenerator<O> {
	toClassName: (name: string, state: CodegenState<O>) => string
	toIdentifier: (name: string, state: CodegenState<O>) => string
	toConstantName: (name: string, state: CodegenState<O>) => string
	toEnumName: (name: string, state: CodegenState<O>) => string
	toOperationName: (path: string, method: string, state: CodegenState<O>) => string
	/** Convert a property name to a name suitable for a model class */
	toModelNameFromPropertyName: (name: string, state: CodegenState<O>) => string
	/**
	 * Return an iteration of a model name in order to generate a unique model name.
	 * The method MUST return a different name for each iteration.
	 * @param name the model name
	 * @param parentNames the parent model names, if any, for reference
	 * @param iteration the iteration number of searching for a unique name, starts from 1
	 * @param state the state
	 * @returns an iterated model name
	 */
	toIteratedModelName: (name: string, parentNames: string[] | undefined, iteration: number, state: CodegenState<O>) => string

	/** Format a value as a literal in the language */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	toLiteral: (value: any, options: CodegenLiteralValueOptions, state: CodegenState<O>) => string
	toNativeType: (options: CodegenNativeTypeOptions, state: CodegenState<O>) => CodegenNativeType
	toNativeArrayType: (options: CodegenNativeArrayTypeOptions, state: CodegenState<O>) => CodegenNativeType
	toNativeMapType: (options: CodegenNativeMapTypeOptions, state: CodegenState<O>) => CodegenNativeType
	/** Return the default value to use for a property as a literal in the language */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	toDefaultValue: (defaultValue: any, options: CodegenDefaultValueOptions, state: CodegenState<O>) => string

	options: (config: CodegenConfig) => O
	operationGroupingStrategy: (state: CodegenState<O>) => CodegenOperationGroupingStrategy<O>

	exportTemplates: (outputPath: string, doc: CodegenDocument, state: CodegenState<O>) => void

	/** Return an array of paths to include in fs.watch when in watch mode */
	watchPaths: (config: CodegenConfig) => string[] | undefined

	/**
	 * Return an array of file patterns, relative to the output path, to delete if they
	 * haven't been modified after exporting.
	 */
	cleanPathPatterns: (options: O) => string[] | undefined
}

/**
 * The options from a config file.
 */
export interface CodegenConfig {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[name: string]: any

	/** The path to the config file, if any */
	configPath?: string
}

/**
 * Code generation specific context attributes that are added to the root context.
 */
export interface CodegenRootContext {
	generatorClass: string
	generatedDate: string
}

export interface CodegenDocument {
	info: CodegenInfo
	groups: CodegenOperationGroup[]
	models: CodegenModel[]
	servers?: CodegenServer[]
	securitySchemes?: CodegenSecurityScheme[]
	securityRequirements?: CodegenSecurityRequirement[]
}

export interface CodegenInfo {
	title: string
	description?: string
	termsOfService?: string
	contact?: CodegenContactObject
	license?: CodegenLicenseObject
	version: string
}

export interface CodegenContactObject {
	name?: string
	url?: string
	email?: string
}
export interface CodegenLicenseObject {
	name: string
	url?: string
}

export interface CodegenServer {
	/** The base URL of the API */
	url: string
	description?: string
}

export interface CodegenOperationGroups {
	[name: string]: CodegenOperationGroup
}

export interface CodegenOperationGroup {
	name: string
	/** The base path for operations in this group, relative to the server URLs */
	path: string
	
	operations: CodegenOperation[]
	consumes?: CodegenMediaType[] // TODO in OpenAPIV2 these are on the document, but not on OpenAPIV3
	produces?: CodegenMediaType[] // TODO in OpenAPIV2 these are on the document, but not on OpenAPIV3
}

export interface CodegenOperation {
	name: string
	httpMethod: string
	/** The operation path, relative to the containing CodegenOperationGroup */
	path: string
	/** The full operation path, relative to the server URLs */
	fullPath: string

	returnType?: string
	returnNativeType?: CodegenNativeType
	consumes?: CodegenMediaType[]
	produces?: CodegenMediaType[]

	allParams?: CodegenParameter[]
	queryParams?: CodegenParameter[]
	pathParams?: CodegenParameter[]
	headerParams?: CodegenParameter[]
	cookieParams?: CodegenParameter[]
	bodyParam?: CodegenParameter
	formParams?: CodegenParameter[]
	nonBodyParams?: CodegenParameter[]

	securityRequirements?: CodegenSecurityRequirement[]
	vendorExtensions?: CodegenVendorExtensions
	responses?: CodegenResponse[]
	defaultResponse?: CodegenResponse
	deprecated?: boolean
	summary?: string
	description?: string
	tags?: string[]

	hasParamExamples?: boolean
	hasQueryParamExamples?: boolean
	hasPathParamExamples?: boolean
	hasHeaderParamExamples?: boolean
	hasCookieParamExamples?: boolean
	hasBodyParamExamples?: boolean
	hasFormParamExamples?: boolean
	hasNonBodyParamExamples?: boolean
	hasResponseExamples?: boolean
}

export interface CodegenResponse extends CodegenPropertyTypeInfoPartial, CodegenTypes {
	code: number
	description: string

	/** The responses contents */
	contents?: CodegenContent[]
	produces?: CodegenMediaType[]
	examples?: CodegenExample[]

	isDefault: boolean
	vendorExtensions?: CodegenVendorExtensions
	headers?: CodegenProperty[]
}

export interface CodegenContent extends CodegenTypes {
	mediaType: CodegenMediaType
	property: CodegenProperty
	examples?: CodegenExample[]
}

export interface CodegenExample {
	name?: string
	mediaType?: CodegenMediaType
	summary?: string
	description?: string
	/** The raw example value, may be a string or any other JSON/YAML type */
	value: any
	/** The example value formatted as a string literal by the generator */
	valueString: string
	valuePretty: string
}

export interface CodegenNativeTypeConstructor {
	/**
	 * 
	 * @param nativeType The type in the native language
	 * @param additionalTypes Special-purpose versions of the native type. Any omitted properties will default to the `nativeType`, 
	 * 	any null properties will end up `undefined`.
	 */
	new(nativeType: string, additionalTypes?: {
		wireType?: string | null
		literalType?: string | null
		concreteType?: string | null
		componentType?: string | null
		componentWireType?: string | null
	}): CodegenNativeType
}

export interface CodegenNativeType {
	/** The type in the native language */
	nativeType: string

	/**
	 * The native language type to use if no translation is done from the communication layer.
	 * e.g. the type as it will be when deserialised from JSON.
	 */
	wireType?: string
	/**
	 * The native language type when expressing this type as a type literal, e.g. in java `java.util.List`
	 * as opposed to `java.util.List<java.lang.String>`, which is not valid as a type literal.
	 */
	literalType?: string
	/**
	 * The concrete native language type to use when creating an object of this type. 
	 */
	concreteType?: string
	/**
	 * The native language type when this type is a component of another type, e.g. an array
	 */
	componentType?: string
	/**
	 * The wire type when this type is a component of another type. Defaults to `componentType`
	 */
	componentWireType?: string

	toString(): string

	equals(other: CodegenNativeType | undefined): boolean

}

export interface CodegenTypes {
	isObject: boolean
	isMap: boolean
	isArray: boolean
	isBoolean: boolean
	isNumber: boolean
	isEnum: boolean
	isDateTime: boolean
	isDate: boolean
	isTime: boolean
	propertyType?: CodegenPropertyType
}

export enum CodegenPropertyType {
	OBJECT,
	MAP,
	ARRAY,
	BOOLEAN,
	NUMBER,
	ENUM,
	STRING,
	DATETIME,
	DATE,
	TIME,
	FILE,
}

export type CodegenPropertyTypeInfoPartial = Partial<CodegenPropertyTypeInfo>

export interface CodegenPropertyTypeInfo {
	/** OpenAPI type */
	type: string
	format?: string

	/** Type in native language */
	nativeType: CodegenNativeType

	componentType?: string
	componentNativeType?: CodegenNativeType

	nullable?: boolean
	readOnly?: boolean
	writeOnly?: boolean
	deprecated?: boolean
}

/* See DefaultCodegen.fromProperty */
export interface CodegenProperty extends CodegenPropertyTypeInfo, CodegenTypes {
	name: string
	description?: string
	title?: string
	exampleValue?: string
	defaultValue?: string
	required: boolean
	vendorExtensions?: CodegenVendorExtensions

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

	/** Nested models */
	models?: CodegenModel[]
}

export enum CodegenModelType {
	DEFINED = 'DEFINED',
	INLINE = 'INLINE',
}

export interface CodegenModel {
	name: string
	modelType: CodegenModelType
	description?: string
	properties?: CodegenProperty[]
	vendorExtensions?: CodegenVendorExtensions

	nativeType: CodegenNativeType

	/** Enums */
	isEnum: boolean
	/** The native type of the enum value */
	enumValueNativeType?: CodegenNativeType
	/** The values making up the enum */
	enumValues?: CodegenEnumValue[]

	/** Parent model */
	parent?: CodegenNativeType
	parentModel?: CodegenModel

	/** Nested models */
	models?: CodegenModel[]

	deprecated?: boolean
}

interface CodegenTypeOptions {
	type: string
	format?: string
	required?: boolean
}

export interface CodegenDefaultValueOptions extends CodegenTypeOptions {
	propertyType?: CodegenPropertyType
	nativeType: CodegenNativeType
}

export type CodegenLiteralValueOptions = CodegenDefaultValueOptions

export enum CodegenTypePurpose {
	/** A type for a model class */
	MODEL = 'MODEL',
	/** A type for an object property */
	PROPERTY = 'PROPERTY',
	/** A type for an enum */
	ENUM = 'ENUM',
	/** A type for a model parent */
	PARENT = 'PARENT',
	/** A type for a Map key */
	KEY = 'KEY',
}

export interface CodegenNativeTypeOptions extends CodegenTypeOptions {
	modelNames?: string[]
	purpose: CodegenTypePurpose
}

export enum CodegenArrayTypePurpose {
	/** A type for an object property */
	PROPERTY = 'PROPERTY',
	/** A type for a model parent */
	PARENT = 'PARENT',
}

export interface CodegenNativeArrayTypeOptions {
	componentNativeType: CodegenNativeType
	required?: boolean
	/** The uniqueItems property from the API spec */
	uniqueItems?: boolean
	modelNames?: string[]
	purpose: CodegenArrayTypePurpose
}

export enum CodegenMapTypePurpose {
	/** A type for an object property */
	PROPERTY = 'PROPERTY',
	/** A type for a model parent */
	PARENT = 'PARENT',
}

export interface CodegenNativeMapTypeOptions {
	keyNativeType: CodegenNativeType
	componentNativeType: CodegenNativeType
	modelNames?: string[]
	purpose: CodegenMapTypePurpose
}

export interface CodegenEnumValue {
	value: any
	literalValue: string
}

export type CodegenParameterIn = 'query' | 'header' | 'path' | 'formData' | 'body'

export interface CodegenParameter extends CodegenPropertyTypeInfo, CodegenTypes {
	name: string
	in: CodegenParameterIn
	
	description?: string
	required?: boolean
	collectionFormat?: string

	examples?: CodegenExample[]

	isQueryParam?: boolean
	isPathParam?: boolean
	isHeaderParam?: boolean
	isCookieParam?: boolean
	isBodyParam?: boolean
	isFormParam?: boolean

	consumes?: CodegenMediaType[]
}

export interface CodegenVendorExtensions {
	[name: string]: any
}

export interface CodegenSecurityRequirement {
	scheme: CodegenSecurityScheme
	scopes?: CodegenAuthScope[]
}

export interface CodegenSecurityScheme {
	name: string
	type: string
	description?: string

	/** The header or query parameter name for apiKey */
	paramName?: string
	in?: 'header' | 'query' | 'cookie'

	/** The http auth scheme for http auth */
	scheme?: string
	
	flows?: CodegenOAuthFlow[]
	openIdConnectUrl?: string

	isBasic?: boolean
	isHttp?: boolean
	isApiKey?: boolean
	isOAuth?: boolean
	isOpenIdConnect?: boolean

	isInQuery?: boolean
	isInHeader?: boolean

	vendorExtensions?: CodegenVendorExtensions
}

export interface CodegenOAuthFlow {
	type: string
	authorizationUrl?: string
	tokenUrl?: string
	refreshUrl?: string
	scopes?: CodegenAuthScope[]

	vendorExtensions?: CodegenVendorExtensions
}

export interface CodegenAuthScope {
	name: string
	description?: string
	
	vendorExtensions?: CodegenVendorExtensions
}

export interface CodegenMediaType {
	/** The media type as it appears in the API spec */
	mediaType: string
	/** Just the mimeType part of the media type */
	mimeType: string
	/** The encoding / charset part of the media type, if present */
	encoding?: string
}

export type CodegenOperationGroupingStrategy<O> = (operation: CodegenOperation, groups: CodegenOperationGroups, state: CodegenState<O>) => void

/**
 * The different HTTP methods supported by OpenAPI.
 * NB. The order of entries in the enum may be used for sorting, see compareHttpMethods
 */
export enum HttpMethods {
	GET = 'GET',
	HEAD = 'HEAD',
	OPTIONS = 'OPTIONS',
	POST = 'POST',
	PUT = 'PUT',
	PATCH = 'PATCH',
	DELETE = 'DELETE',
}
