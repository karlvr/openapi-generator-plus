import { CodegenOptions, CodegenGenerator, CodegenLiteralValueOptions, CodegenState, CodegenNativeTypeConstructor } from './types'

/**
 * The options given to a generator module function when it is constructed.
 */
export interface CodegenGeneratorOptions<O extends CodegenOptions> {
	baseGenerator: <O extends CodegenOptions>() => Pick<CodegenGenerator<O>, 'toIteratedModelName' | 'toModelNameFromPropertyName'>
	InvalidModelError: ErrorConstructor
	NativeType: CodegenNativeTypeConstructor
	utils: {
		stringLiteralValueOptions: <O extends CodegenOptions>(state: CodegenState<O>) => CodegenLiteralValueOptions
	}
}

export type CodegenGeneratorConstructor<O extends CodegenOptions> = (generatorOptions: CodegenGeneratorOptions<O>) => CodegenGenerator<O>
