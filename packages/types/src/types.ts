import { OpenAPI } from 'openapi-types'
import { IndexedType } from '@openapi-generator-plus/indexed-type'

export interface CodegenInputDocument {
	$refs: {
		get: <T>(name: string) => T
	}
	root: OpenAPI.Document
}

export interface CodegenState {
	generator: CodegenGenerator
}

export enum CodegenGeneratorType {
	SERVER = 'SERVER',
	CLIENT = 'CLIENT',
	DOCUMENTATION = 'DOCUMENTATION',
}

/**
 * The interface implemented by language-specific generator modules.
 */
export interface CodegenGenerator {
	generatorType: () => CodegenGeneratorType
	
	/** Convert the given name to the native class name style */
	toClassName: (name: string) => string
	/** Convert the given name to the native identifier style */
	toIdentifier: (name: string) => string
	/** Convert the given name to the native constant identifier style */
	toConstantName: (name: string) => string
	/** Convert the given name to the native enum member name style */
	toEnumMemberName: (name: string) => string
	toOperationName: (path: string, method: string) => string
	toOperationGroupName: (name: string) => string
	/** Convert the given name to the native schema name style */
	toSchemaName: (name: string, options: CodegenSchemaNameOptions) => string
	/**
	 * Return an iteration of a model name in order to generate a unique model name.
	 * The method MUST return a different name for each iteration.
	 * @param name the model name
	 * @param parentNames the parent model names, if any, for reference
	 * @param iteration the iteration number of searching for a unique name, starts from 1
	 * @param state the state
	 * @returns an iterated model name
	 */
	toIteratedModelName: (name: string, parentNames: string[] | undefined, iteration: number) => string

	/** Format a value as a literal in the language */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	toLiteral: (value: any, options: CodegenLiteralValueOptions) => string
	toNativeType: (options: CodegenNativeTypeOptions) => CodegenNativeType
	toNativeObjectType: (options: CodegenNativeObjectTypeOptions) => CodegenNativeType
	toNativeArrayType: (options: CodegenNativeArrayTypeOptions) => CodegenNativeType
	toNativeMapType: (options: CodegenNativeMapTypeOptions) => CodegenNativeType
	/** Return the default value to use for a property as a literal in the language */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	toDefaultValue: (defaultValue: any, options: CodegenDefaultValueOptions) => CodegenValue

	operationGroupingStrategy: () => CodegenOperationGroupingStrategy

	/** Apply any post-processing to the given model.
	 * @returns `false` if the model should be excluded.
	 */
	postProcessModel?: (model: CodegenModel) => boolean | void

	/**
	 * Apply any post-processing to the given document.
	 */
	postProcessDocument?: (doc: CodegenDocument) => void

	/** Create the root context for the templates */
	templateRootContext: () => Record<string, unknown>
	
	exportTemplates: (outputPath: string, doc: CodegenDocument) => Promise<void>

	/** Return an array of paths to include in fs.watch when in watch mode */
	watchPaths: () => string[] | undefined

	/**
	 * Return an array of file patterns, relative to the output path, to delete if they
	 * haven't been modified after exporting.
	 */
	cleanPathPatterns: () => string[] | undefined

	/**
	 * Return `true` if named models of a collection type (ie. array or map) should be generated.
	 * They will use the collection type as their parent class.
	 * If not, then the collection type is used directly without generating a model class for it.
	 */
	generateCollectionModels?: () => boolean
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

export interface CodegenDocument {
	info: CodegenInfo
	groups: CodegenOperationGroup[]
	models: CodegenModels
	servers: CodegenServer[] | null
	securitySchemes: CodegenSecurityScheme[] | null
	securityRequirements: CodegenSecurityRequirement[] | null
}

export interface CodegenInfo {
	title: string
	description: string | null
	termsOfService: string | null
	contact: CodegenContactObject | null
	license: CodegenLicenseObject | null
	version: string
}

export interface CodegenContactObject {
	name: string | null
	url: string | null
	email: string | null
}
export interface CodegenLicenseObject {
	name: string
	url: string | null
}

export interface CodegenServer {
	/** The base URL of the API */
	url: string
	description: string | null
	vendorExtensions: CodegenVendorExtensions | null
}

export interface CodegenOperationGroups {
	[name: string]: CodegenOperationGroup
}

export interface CodegenOperationGroup {
	name: string
	/** The base path for operations in this group, relative to the server URLs */
	path: string
	description: string | null
	
	operations: CodegenOperation[]
	consumes: CodegenMediaType[] | null // TODO in OpenAPIV2 these are on the document, but not on OpenAPIV3
	produces: CodegenMediaType[] | null // TODO in OpenAPIV2 these are on the document, but not on OpenAPIV3
}

export interface CodegenOperation {
	name: string
	httpMethod: string
	/** The operation path, relative to the containing CodegenOperationGroup */
	path: string
	/** The full operation path, relative to the server URLs */
	fullPath: string

	returnType: string | null
	returnNativeType: CodegenNativeType | null
	consumes: CodegenMediaType[] | null
	produces: CodegenMediaType[] | null

	parameters: CodegenParameters | null
	queryParams: CodegenParameters | null
	pathParams: CodegenParameters | null
	headerParams: CodegenParameters | null
	cookieParams: CodegenParameters | null
	formParams: CodegenParameters | null

	requestBody: CodegenRequestBody | null

	securityRequirements: CodegenSecurityRequirement[] | null
	vendorExtensions: CodegenVendorExtensions | null
	responses: CodegenResponses | null
	defaultResponse: CodegenResponse | null
	deprecated: boolean
	summary: string | null
	description: string | null
	tags: string[] | null

	hasParamExamples: boolean
	hasQueryParamExamples: boolean
	hasPathParamExamples: boolean
	hasHeaderParamExamples: boolean
	hasCookieParamExamples: boolean
	hasFormParamExamples: boolean
	hasRequestBodyExamples: boolean
	hasResponseExamples: boolean
}

export type IndexedCollectionType<T> = IndexedType<string, T>

export type CodegenResponses = IndexedCollectionType<CodegenResponse>
export type CodegenParameters = IndexedCollectionType<CodegenParameter>

export interface CodegenResponse {
	code: number
	description: string

	/** The responses contents */
	contents: CodegenContent[] | null
	produces: CodegenMediaType[] | null

	defaultContent: CodegenContent | null

	isDefault: boolean
	vendorExtensions: CodegenVendorExtensions | null
	headers: CodegenHeaders | null
}

export type CodegenHeaders = IndexedCollectionType<CodegenHeader>

export interface CodegenHeader extends CodegenParameterBase {
	name: string
	examples: CodegenExamples | null
}

export interface CodegenContent extends CodegenSchemaInfo {
	mediaType: CodegenMediaType
	examples: CodegenExamples | null
	schema: CodegenSchema
}

export type CodegenExamples = IndexedCollectionType<CodegenExample>

export interface CodegenExample extends CodegenTypeInfo {
	name: string | null
	mediaType: CodegenMediaType | null
	summary: string | null
	description: string | null
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
		serializedType?: string | null
		literalType?: string | null
		concreteType?: string | null
		componentType?: CodegenNativeType | null
	}): CodegenNativeType
}

export interface CodegenNativeType {
	/** The type in the native language */
	nativeType: string

	/**
	 * The native language type to use if no translation is done from the communication layer.
	 * e.g. the type as it will be when deserialised from JSON.
	 */
	serializedType?: string
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

}

export enum CodegenSchemaType {
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
	format: string | null
	schemaType: CodegenSchemaType

	/** Type in native language */
	nativeType: CodegenNativeType
	// TODO we should have a CodegenNativeArrayType implementation of CodegenNativeType that has componentType, and same for map
	// and then rename componentType in CodegenNativeType to be less confusing

	/** Component types for array and map properties */
	componentSchema: CodegenSchema | null
}

export interface CodegenSchemaInfo extends CodegenTypeInfo {
	required: boolean
	nullable: boolean
	readOnly: boolean
	writeOnly: boolean
	deprecated: boolean
}

export interface CodegenProperty extends CodegenSchema {
	name: string
}

export interface CodegenSchema extends CodegenSchemaInfo {
	description: string | null
	title: string | null
	example: CodegenExample | null
	defaultValue: CodegenValue | null

	vendorExtensions: CodegenVendorExtensions | null

	/* Validation */
	maximum: number | null
	exclusiveMaximum: boolean | null
	minimum: number | null
	exclusiveMinimum: boolean | null
	maxLength: number | null
	minLength: number | null
	pattern: string | null
	maxItems: number | null
	minItems: number | null
	uniqueItems: boolean | null
	multipleOf: number | null

	/** The model that is the type of this schema, if any */
	model: CodegenModel | null
}

/**
 * Represents a value to be included in the generated output.
 */
export interface CodegenValue {
	/** The value in its raw JavaScript format */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	value: any | null
	/** The value formatted as a literal in the native language */
	literalValue: string
}

/**
 * An object that defines a naming scope in the generated result.
 * Allows room in future for operations to define a naming scope.
 */
export interface CodegenScope {
	/** The scoped name of this model as an array. The components are as returned by CodegenGenerator.toSchemaName */
	scopedName: string[]

	/** Nested models */
	models: CodegenModels | null
}

export type CodegenModels = IndexedCollectionType<CodegenModel>

export interface CodegenModel extends CodegenTypeInfo, CodegenScope {
	/** The name of this model, as returned by CodegenGenerator.toSchemaName */
	name: string
	/** The name of the model in the API spec as it should be used when serialized (e.g. in JSON), if the model was named */
	serializedName: string | null
	description: string | null

	properties: CodegenProperties | null

	/* Polymorphism */

	/** Information about the discriminator that this model uses to differentiate either its children or submodels */
	discriminator: CodegenDiscriminator | null

	/** Information about the values of discriminators for this model */
	discriminatorValues: CodegenDiscriminatorValue[] | null

	/** The models that have this model as their parent */
	children: CodegenModels | null

	/** Whether this model is an interface; it has no properties and exists as a marker in the type system rather than a functional object */
	isInterface: boolean

	/** The interface models that this model complies with */
	implements: CodegenModels | null
	implementors: CodegenModels | null

	vendorExtensions: CodegenVendorExtensions | null

	/** The native type to use when declaring a property of this model type */
	propertyNativeType: CodegenNativeType

	/** Enums */
	/** The native type of the enum value */
	enumValueNativeType: CodegenNativeType | null
	/** The values making up the enum */
	enumValues: CodegenEnumValues | null

	/** Parent model */
	parent: CodegenModel | null
	/** The native type of the parent.
	 * This may be set even when `parent` is not set, in case the native parent is not a model.
	 */
	parentNativeType: CodegenNativeType | null

	deprecated: boolean
}

export type CodegenProperties = IndexedCollectionType<CodegenProperty>

export interface CodegenModelReference {
	model: CodegenModel
	name: string
}

export interface CodegenDiscriminator extends CodegenTypeInfo {
	name: string
	mappings: CodegenDiscriminatorMappings | null
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

export interface CodegenSchemaNameOptions {
	/** Whether the name of this schema was specified in the API specification, or guessed from context */
	nameSpecified: boolean
	purpose: CodegenSchemaPurpose
	schemaType: CodegenSchemaType
}

interface CodegenTypeOptions {
	type: string
	format?: string | null
	required: boolean
	vendorExtensions?: CodegenVendorExtensions | null
}

export interface CodegenDefaultValueOptions extends CodegenTypeOptions {
	schemaType: CodegenSchemaType
	nativeType: CodegenNativeType
}

export type CodegenLiteralValueOptions = CodegenDefaultValueOptions

/**
 * Describes the purpose for which a schema is being used.
 */
export enum CodegenSchemaPurpose {
	/**
	 * The schema is being used as an item in an array.
	 */
	ARRAY_ITEM = 'ARRAY_ITEM',
	/**
	 * The schema is being used as a value in a map.
	 */
	MAP_VALUE = 'MAP_VALUE',
	/**
	 * The schema is being used as an object model.
	 */
	MODEL = 'MODEL',
	/**
	 * The schema is being used to create a partial model, for absorbing into another.
	 */
	PARTIAL_MODEL = 'PARTIAL_MODEL',
	/**
	 * The schema is being used as a parameter.
	 */
	PARAMETER = 'PARAMETER',
	/**
	 * The schema is being used for a model property.
	 */
	PROPERTY = 'PROPERTY',
	/**
	 * The schema is being used for a request body.
	 */
	REQUEST_BODY = 'REQUEST_BODY',
	/**
	 * The schema is being used for a response.
	 */
	RESPONSE = 'RESPONSE',
	HEADER = 'HEADER',
}

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
	vendorExtensions: CodegenVendorExtensions | null
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
	vendorExtensions: CodegenVendorExtensions | null
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
	vendorExtensions: CodegenVendorExtensions | null
	purpose: CodegenMapTypePurpose
}

export type CodegenEnumValues = IndexedCollectionType<CodegenEnumValue>

export interface CodegenEnumValue {
	name: string
	literalValue: string
	value: string
}

export type CodegenParameterIn = 'query' | 'header' | 'path' | 'formData' | 'body'

interface CodegenParameterBase extends CodegenSchemaInfo {
	name: string
	
	description: string | null
	collectionFormat: string | null

	schema: CodegenSchema

	vendorExtensions: CodegenVendorExtensions | null
}

export interface CodegenParameter extends CodegenParameterBase {
	in: CodegenParameterIn
	examples: CodegenExamples | null
	defaultValue: CodegenValue | null

	isQueryParam: boolean
	isPathParam: boolean
	isHeaderParam: boolean
	isCookieParam: boolean
	isFormParam: boolean
}
export interface CodegenRequestBody extends CodegenParameterBase {
	contents: CodegenContent[]
	consumes: CodegenMediaType[]
	defaultContent: CodegenContent
}

export interface CodegenVendorExtensions {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[name: string]: any
}

export interface CodegenSecurityRequirement {
	scheme: CodegenSecurityScheme
	scopes: CodegenAuthScope[] | null
}

export interface CodegenSecurityScheme {
	name: string
	type: string
	description: string | null

	/** The header or query parameter name for apiKey */
	paramName: string | null
	in: 'header' | 'query' | 'cookie' | null

	/** The http auth scheme for http auth */
	scheme: string | null
	
	flows: CodegenOAuthFlow[] | null
	openIdConnectUrl: string | null

	isBasic: boolean
	isHttp: boolean
	isApiKey: boolean
	isOAuth: boolean
	isOpenIdConnect: boolean

	isInQuery: boolean
	isInHeader: boolean

	vendorExtensions: CodegenVendorExtensions | null
}

export interface CodegenOAuthFlow {
	type: string
	authorizationUrl: string | null
	tokenUrl: string | null
	refreshUrl: string | null
	scopes: CodegenAuthScope[] | null

	vendorExtensions: CodegenVendorExtensions | null
}

export interface CodegenAuthScope {
	name: string
	description: string | null
	
	vendorExtensions: CodegenVendorExtensions | null
}

export interface CodegenMediaType {
	/** The media type as it appears in the API spec */
	mediaType: string
	/** Just the mimeType part of the media type */
	mimeType: string
	/** The encoding / charset part of the media type, if present */
	encoding: string | null
}

export type CodegenOperationGroupingStrategy = (operation: CodegenOperation, groups: CodegenOperationGroups, state: CodegenState) => void

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
