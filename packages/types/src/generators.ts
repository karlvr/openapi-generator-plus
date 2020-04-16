import { CodegenGenerator, CodegenLiteralValueOptions, CodegenState, CodegenNativeTypeConstructor, CodegenOperationGroupingStrategy, IndexedObjectsType } from './types'
import { CodegenTransformingNativeTypeConstructor, CodegenComposingNativeTypeConstructor, CodegenFullTransformingNativeTypeConstructor, CodegenFullComposingNativeTypeConstructor } from './native-types'

export type CodegenBaseGeneratorConstructor = <O>() => Pick<CodegenGenerator<O>, 'toEnumMemberName' | 'toIteratedModelName'>

/**
 * The options given to a generator module function when it is constructed.
 */
export interface CodegenGeneratorContext {
	baseGenerator: CodegenBaseGeneratorConstructor
	operationGroupingStrategies: {
		addToGroupsByPath: CodegenOperationGroupingStrategy
		addToGroupsByTag: CodegenOperationGroupingStrategy
		addToGroupsByTagOrPath: CodegenOperationGroupingStrategy
	}
	NativeType: CodegenNativeTypeConstructor
	TransformingNativeType: CodegenTransformingNativeTypeConstructor
	ComposingNativeType: CodegenComposingNativeTypeConstructor
	FullTransformingNativeType: CodegenFullTransformingNativeTypeConstructor
	FullComposingNativeType: CodegenFullComposingNativeTypeConstructor
	utils: {
		stringLiteralValueOptions: <O>(state: CodegenState<O>) => CodegenLiteralValueOptions
		/** Convert the internal IndexedObjectsType to an iterable of values */
		values: <T>(indexed: IndexedObjectsType<T>) => Iterable<T>
	}
}

export type CodegenGeneratorConstructor<O, C = CodegenGeneratorContext> = (context: C) => CodegenGenerator<O>
