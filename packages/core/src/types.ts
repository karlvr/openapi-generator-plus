import { CodegenState, CodegenInputDocument, CodegenObjectSchemas, CodegenSchema } from '@openapi-generator-plus/types'
import { OpenAPIX } from './types/patches'


export enum CodegenSpecVersion {
	OpenAPIV2 = 200, /* https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md */
	OpenAPIV3 = 300, /* https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.2.md */
}

export interface InternalCodegenState extends CodegenState, CodegenInputDocument {
	/** A hash of fully qualified model names that have been used */
	usedModelFullyQualifiedNames: { [name: string]: boolean | undefined }
	/** A hash of OpenAPI schemas to generated schemas, populated as we generate schemas to avoid generating the same schema twice */
	knownSchemas: Map<OpenAPIX.SchemaObject, CodegenSchema>
	/** A hash of $ref to fully qualified model name, representing reserved model names */
	reservedNames: { [$ref: string]: string | undefined }
	/** The map of top-level models */
	models: CodegenObjectSchemas
	specVersion: CodegenSpecVersion
}
