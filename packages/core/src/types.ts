import { CodegenModel, CodegenState, CodegenInputDocument } from '@openapi-generator-plus/types'


export enum CodegenSpecVersion {
	OpenAPIV2 = 200, /* https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md */
	OpenAPIV3 = 300, /* https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.2.md */
}

export interface InternalCodegenState<O = {}> extends CodegenState<O>, CodegenInputDocument {
	/** A hash of fully qualified model names that have been used */
	usedModelFullyQualifiedNames: { [name: string]: boolean }
	/** An array of inline models to be added to the export */
	inlineModels: CodegenModel[]
	specVersion: CodegenSpecVersion
}
