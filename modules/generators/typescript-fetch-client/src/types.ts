import { CodegenOptions, CodegenRootContext } from 'openapi-generator-node-core'

/**
 * Options specific to Java that the user can provide to the code generation process.
 */
export interface CodegenOptionsTypescript extends CodegenOptions {
	apiPackage: string
	apiServiceImplPackage: string
	modelPackage: string
	invokerPackage: string
	useBeanValidation?: boolean
}

export interface CodegenRootContextTypescript extends CodegenRootContext {
	imports?: string[]
}
