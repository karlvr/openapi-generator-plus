import { CodegenOptions, CodegenRootContext } from 'openapi-generator-node-core'

/**
 * Options specific to the template that the user can provide to the code generation process.
 */
export interface CodegenOptionsTypescript extends CodegenOptions {
	npmName?: string
	npmVersion?: string
	supportsES6: boolean
}
