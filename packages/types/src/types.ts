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

export enum CodegenGeneratorType {
	SERVER = 'SERVER',
	CLIENT = 'CLIENT',
	DOCUMENTATION = 'DOCUMENTATION',
}

/**
 * The interface implemented by language-specific generator modules.
 */
export interface CodegenGenerator<O> {
	generatorType: () => CodegenGeneratorType
	
	/** Convert the given name to the native class name style */
	toClassName: (name: string, state: CodegenState<O>) => string
	/** Convert the given name to the native identifier style */
	toIdentifier: (name: string, state: CodegenState<O>) => string
	/** Convert the given name to the native constant identifier style */
	toConstantName: (name: string, state: CodegenState<O>) => string
	/** Convert the given name to the native enum name style */
	toEnumName: (name: string, state: CodegenState<O>) => string
	/** Convert the given name to the native enum member name style */
	toEnumMemberName: (name: string, state: CodegenState<O>) => string
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
	toNativeObjectType: (options: CodegenNativeObjectTypeOptions, state: CodegenState<O>) => CodegenNativeType
	toNativeArrayType: (options: CodegenNativeArrayTypeOptions, state: CodegenState<O>) => CodegenNativeType
	toNativeMapType: (options: CodegenNativeMapTypeOptions, state: CodegenState<O>) => CodegenNativeType
	/** Return the default value to use for a property as a literal in the language */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	toDefaultValue: (defaultValue: any, options: CodegenDefaultValueOptions, state: CodegenState<O>) => CodegenValue

	options: (config: CodegenConfig) => O
	operationGroupingStrategy: (state: CodegenState<O>) => CodegenOperationGroupingStrategy

	/** Apply any post-processing to the given model.
	 * @returns `false` if the model should be excluded.
	 */
	postProcessModel?: (model: CodegenModel, state: CodegenState<O>) => boolean | void

	exportTemplates: (outputPath: string, doc: CodegenDocument, state: CodegenState<O>) => Promise<void>

	/** Return an array of paths to include in fs.watch when in watch mode */
	watchPaths: (config: CodegenConfig) => string[] | undefined

	/**
	 * Return an array of file patterns, relative to the output path, to delete if they
	 * haven't been modified after exporting.
	 */
	cleanPathPatterns: (options: O) => string[] | undefined

	/**
	 * Return `true` if named models of a collection type (ie. array or map) should be generated.
	 * They will use the collection type as their parent class.
	 * If not, then the collection type is used directly without generating a model class for it.
	 */
	generateCollectionModels?: (options: O) => boolean
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
	models: CodegenModels
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

	parameters?: CodegenParameters
	queryParams?: CodegenParameters
	pathParams?: CodegenParameters
	headerParams?: CodegenParameters
	cookieParams?: CodegenParameters
	formParams?: CodegenParameters

	requestBody?: CodegenRequestBody

	securityRequirements?: CodegenSecurityRequirement[]
	vendorExtensions?: CodegenVendorExtensions
	responses?: CodegenResponses
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
	hasFormParamExamples?: boolean
	hasRequestBodyExamples?: boolean
	hasResponseExamples?: boolean
}

// export type IndexedCollectionType<T> = Map<string, T>
export interface IndexedCollectionType<T> {
	[key: string]: T
}

export type CodegenResponses = IndexedCollectionType<CodegenResponse>
export type CodegenParameters = IndexedCollectionType<CodegenParameter>

export interface CodegenResponse extends Partial<CodegenTypeInfo> {
	code: number
	description: string

	/** The responses contents */
	contents?: CodegenContent[]
	produces?: CodegenMediaType[]

	isDefault: boolean
	vendorExtensions?: CodegenVendorExtensions
	headers?: CodegenHeaders
}

export type CodegenHeaders = IndexedCollectionType<CodegenProperty>

export interface CodegenContent extends CodegenTypeInfo {
	mediaType: CodegenMediaType
	examples?: CodegenExamples
	schema: CodegenSchema
}

export type CodegenExamples = IndexedCollectionType<CodegenExample>

export interface CodegenExample extends CodegenTypeInfo {
	name?: string
	mediaType?: CodegenMediaType
	summary?: string
	description?: string
	/** The raw example value, may be a string or any other JSON/YAML type */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	value: any
	/** The example as a literal in the native language */
	valueLiteral: string
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
		componentType?: CodegenNativeType | null
	}): CodegenNativeType
}

export type CodegenNativeTypeTransformer = (nativeTypeString: string) => string | undefined

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
	 * The native language type when this type is a component of another type, e.g. an array.
	 * NOTE: The `componentType` may be set to `this` if there is no special component type for this type.
	 */
	componentType?: CodegenNativeType

	toString(): string

	equals(other: CodegenNativeType | undefined): boolean

	/**
	 * Transform this native type in-place.
	 * We transform in place so that all the places that this native type are used will
	 * receive the changes.
	 */
	transform(transformer: CodegenNativeTypeTransformer): void

}

export enum CodegenPropertyType {
	OBJECT = 'OBJECT',
	MAP = 'MAP',
	ARRAY = 'ARRAY',
	BOOLEAN = 'BOOLEAN',
	NUMBER = 'NUMBER',
	ENUM = 'ENUM',
	STRING = 'STRING',
	DATETIME = 'DATETIME',
	DATE = 'DATE',
	TIME = 'TIME',
	FILE = 'FILE',
}

export interface CodegenTypeInfo {
	/** OpenAPI type */
	type: string
	format?: string
	propertyType: CodegenPropertyType

	/** Type in native language */
	nativeType: CodegenNativeType
	// TODO we should have a CodegenNativeArrayType implementation of CodegenNativeType that has componentType, and same for map
	// and then rename componentType in CodegenNativeType to be less confusing

	/** Component types for array and map properties */
	componentType?: string
	componentNativeType?: CodegenNativeType

	nullable?: boolean
	readOnly?: boolean
	writeOnly?: boolean
	deprecated?: boolean
}

export interface CodegenProperty extends CodegenSchema {
	name: string
}

export interface CodegenSchema extends CodegenTypeInfo {
	description?: string
	title?: string
	exampleValue?: string
	defaultValue?: CodegenValue
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

	/** The model that is the type of this schema, if any */
	model?: CodegenModel
	/** If this schema is an array or map type, the model of the components of this schema, if any */
	componentModel?: CodegenModel
}

/**
 * Represents a value to be included in the generated output.
 */
export interface CodegenValue {
	/** The value in its raw JavaScript format */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	value?: any
	/** The value formatted as a literal in the native language */
	literalValue: string
}

/**
 * An object that defines a naming scope in the generated result.
 * Allows room in future for operations to define a naming scope.
 */
export interface CodegenScope {
	/** The scoped name of this model as an array */
	scopedName: string[]

	/** Nested models */
	models?: CodegenModels
}

export type CodegenModels = IndexedCollectionType<CodegenModel>

export interface CodegenModel extends CodegenTypeInfo, CodegenScope {
	/** The name of this model */
	name: string
	description?: string

	properties?: CodegenProperties

	/* Polymorphism */

	/** Information about the discriminator that this model uses to differentiate either its children or submodels */
	discriminator?: CodegenDiscriminator

	/** Information about the values of discriminators for this model */
	discriminatorValues?: CodegenDiscriminatorValue[]

	/** The models that have this model as their parent */
	children?: CodegenModels

	/** Whether this model is an interface; it has no properties and exists as a marker in the type system rather than a functional object */
	isInterface?: boolean

	/** The interface models that this model complies with */
	implements?: CodegenModels
	implementors?: CodegenModels

	vendorExtensions?: CodegenVendorExtensions

	/** The native type to use when declaring a property of this model type */
	propertyNativeType: CodegenNativeType

	/** Enums */
	/** The native type of the enum value */
	enumValueNativeType?: CodegenNativeType
	/** The values making up the enum */
	enumValues?: CodegenEnumValues

	/** Parent model */
	parent?: CodegenModel
	/** The native type of the parent.
	 * This may be set even when `parent` is not set, in case the native parent is not a model.
	 */
	parentNativeType?: CodegenNativeType

	deprecated?: boolean
}

export type CodegenProperties = IndexedCollectionType<CodegenProperty>

export interface CodegenModelReference {
	model: CodegenModel
	name: string
}

export interface CodegenDiscriminator extends CodegenTypeInfo {
	name: string
	mappings?: CodegenDiscriminatorMappings
	references: CodegenModelReference[]
}

export interface CodegenDiscriminatorValue {
	/** The model containing the discriminator */
	model: CodegenModel
	/** The value literal in the native language */
	value: string
}

export interface CodegenDiscriminatorMappings {
	[$ref: string]: string
}

interface CodegenTypeOptions {
	type: string
	format?: string
	required?: boolean
}

export interface CodegenDefaultValueOptions extends CodegenTypeOptions {
	propertyType: CodegenPropertyType
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
	/** A type for a discriminator */
	DISCRIMINATOR = 'DISCRIMINATOR',
}

export interface CodegenNativeTypeOptions extends CodegenTypeOptions {
	purpose: CodegenTypePurpose
}

export interface CodegenNativeObjectTypeOptions {
	modelNames: string[]
	purpose: CodegenTypePurpose
	required?: boolean
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

export type CodegenEnumValues = IndexedCollectionType<CodegenEnumValue>

export interface CodegenEnumValue {
	name: string
	literalValue: string
}

export type CodegenParameterIn = 'query' | 'header' | 'path' | 'formData' | 'body'

interface CodegenParameterBase extends CodegenTypeInfo {
	name: string
	
	description?: string
	required?: boolean
	collectionFormat?: string

	vendorExtensions?: CodegenVendorExtensions
}

export interface CodegenParameter extends CodegenParameterBase {
	in: CodegenParameterIn
	examples?: CodegenExamples

	isQueryParam?: boolean
	isPathParam?: boolean
	isHeaderParam?: boolean
	isCookieParam?: boolean
	isFormParam?: boolean

	schema: CodegenSchema
}
export interface CodegenRequestBody extends CodegenParameterBase {

	contents: CodegenContent[]
	consumes: CodegenMediaType[]
}

export interface CodegenVendorExtensions {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

export type CodegenOperationGroupingStrategy<O = {}> = (operation: CodegenOperation, groups: CodegenOperationGroups, state: CodegenState<O>) => void

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
	TRACE = 'TRACE',
}
