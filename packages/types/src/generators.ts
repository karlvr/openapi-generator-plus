import { CodegenGenerator, CodegenLiteralValueOptions, CodegenState, CodegenNativeTypeConstructor } from './types'
import { CodegenTransformingNativeTypeConstructor, CodegenComposingNativeTypeConstructor, CodegenFullTransformingNativeTypeConstructor, CodegenFullComposingNativeTypeConstructor } from './native-types'

export type CodegenBaseGeneratorConstructor = <O>() => Pick<CodegenGenerator<O>, 'toEnumMemberName' | 'toIteratedModelName' | 'toModelNameFromPropertyName'>

/**
 * The options given to a generator module function when it is constructed.
 */
export interface CodegenGeneratorOptions {
	baseGenerator: CodegenBaseGeneratorConstructor
	InvalidModelError: ErrorConstructor
	NativeType: CodegenNativeTypeConstructor
	TransformingNativeType: CodegenTransformingNativeTypeConstructor
	ComposingNativeType: CodegenComposingNativeTypeConstructor
	FullTransformingNativeType: CodegenFullTransformingNativeTypeConstructor
	FullComposingNativeType: CodegenFullComposingNativeTypeConstructor
	utils: {
		stringLiteralValueOptions: <O>(state: CodegenState<O>) => CodegenLiteralValueOptions
	}
}

export type CodegenGeneratorConstructor<O> = (generatorOptions: CodegenGeneratorOptions) => CodegenGenerator<O>
