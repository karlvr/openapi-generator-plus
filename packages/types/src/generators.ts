import { CodegenGenerator, CodegenLiteralValueOptions, CodegenState, CodegenNativeTypeConstructor } from './types'

/**
 * The options given to a generator module function when it is constructed.
 */
export interface CodegenGeneratorOptions {
	baseGenerator: <O>() => Pick<CodegenGenerator<O>, 'toIteratedModelName' | 'toModelNameFromPropertyName'>
	InvalidModelError: ErrorConstructor
	NativeType: CodegenNativeTypeConstructor
	utils: {
		stringLiteralValueOptions: <O>(state: CodegenState<O>) => CodegenLiteralValueOptions
	}
}

export type CodegenGeneratorConstructor<O> = (generatorOptions: CodegenGeneratorOptions) => CodegenGenerator<O>
