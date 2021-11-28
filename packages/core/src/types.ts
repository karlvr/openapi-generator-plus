import { CodegenState, CodegenInputDocument, CodegenSchema, CodegenNamedSchemas, CodegenLogFunction } from '@openapi-generator-plus/types'
import { OpenAPIX } from './types/patches'


export enum CodegenSpecVersion {
	OpenAPIV2 = 200, /* https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md */
	OpenAPIV3 = 300, /* https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.2.md */
}

export interface InternalCodegenState extends CodegenState, CodegenInputDocument {
	/** A hash of fully qualified schema names that have been used */
	usedFullyQualifiedSchemaNames: { [name: string]: boolean | undefined }
	/** A hash of OpenAPI schemas to generated schemas, populated as we generate schemas to avoid generating the same schema twice */
	knownSchemas: Map<OpenAPIX.SchemaObject, CodegenSchema>
	knownSchemasByRef: Map<string, CodegenSchema>
	/** A hash of $ref to fully qualified model name, representing reserved schema names */
	reservedSchemaNames: { [$ref: string]: string | undefined }
	/** The map of top-level named schemas */
	schemas: CodegenNamedSchemas
	specVersion: CodegenSpecVersion
	/* We override CodegenState so we always have a log function */
	log: CodegenLogFunction
}
