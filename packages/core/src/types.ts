import { CodegenModel, CodegenState, CodegenInputDocument } from '@openapi-generator-plus/types'
import { OpenAPIX } from './types/patches'


export enum CodegenSpecVersion {
	OpenAPIV2 = 200, /* https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md */
	OpenAPIV3 = 300, /* https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.2.md */
}

export interface InternalCodegenState<O = {}> extends CodegenState<O>, CodegenInputDocument {
	/** A hash of fully qualified model names that have been used */
	usedModelFullyQualifiedNames: { [name: string]: boolean | undefined }
	/** A hash of generated models indexed by ref */
	modelsBySchema: Map<OpenAPIX.SchemaObject, CodegenModel>
	/** A hash of $ref to fully qualified model name, representing reserved model names */
	reservedNames: { [$ref: string]: string | undefined }
	/** The array of top-level models */
	models: CodegenModel[]
	specVersion: CodegenSpecVersion
}
