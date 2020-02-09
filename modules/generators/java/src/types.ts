import { CodegenOptions } from 'openapi-generator-node-core'

/**
 * Options specific to Java that the user can provide to the code generation process.
 */
export interface CodegenOptionsJava extends CodegenOptions {
	apiPackage: string
	apiServiceImplPackage: string
	modelPackage: string
	invokerPackage: string
	useBeanValidation: boolean

	dateImplementation: string
	timeImplementation: string
	dateTimeImplementation: string

	constantStyle: ConstantStyle
	imports?: string[]
}

export const enum ConstantStyle {
	snake = 'snake',
	allCaps = 'allCaps',
	camelCase = 'camelCase',
}
