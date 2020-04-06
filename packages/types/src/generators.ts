import { CodegenGenerator, CodegenLiteralValueOptions, CodegenState, CodegenNativeTypeConstructor } from './types'

export type CodegenBaseGeneratorConstructor = <O>() => Pick<CodegenGenerator<O>, 'toEnumMemberName' | 'toIteratedModelName' | 'toModelNameFromPropertyName'>

/**
 * The options given to a generator module function when it is constructed.
 */
export interface CodegenGeneratorOptions {
	baseGenerator: CodegenBaseGeneratorConstructor
	InvalidModelError: ErrorConstructor
	NativeType: CodegenNativeTypeConstructor
	utils: {
		stringLiteralValueOptions: <O>(state: CodegenState<O>) => CodegenLiteralValueOptions
	}
}

export type CodegenGeneratorConstructor<O> = (generatorOptions: CodegenGeneratorOptions) => CodegenGenerator<O>
