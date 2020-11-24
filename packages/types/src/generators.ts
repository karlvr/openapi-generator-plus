import { CodegenGenerator, CodegenLiteralValueOptions, CodegenState, CodegenNativeTypeConstructor, CodegenOperationGroupingStrategy, IndexedCollectionType, CodegenConfig } from './types'
import { CodegenTransformingNativeTypeConstructor, CodegenComposingNativeTypeConstructor, CodegenFullTransformingNativeTypeConstructor, CodegenFullComposingNativeTypeConstructor } from './native-types'

export type CodegenBaseGeneratorConstructor<C = CodegenGeneratorContext> = (config: CodegenConfig, context: C) => Pick<CodegenGenerator, 'toEnumMemberName' | 'toIteratedSchemaName'>

/**
 * The options given to a generator module function when it is constructed.
 */
export interface CodegenGeneratorContext {
	/**
	 * Returns the current generator instance. This is only valid after the generator constructor
	 * has returned.
	 */
	generator: () => CodegenGenerator
	/**
	 * Set the current generator instance for this context.
	 */
	setGenerator: (generator: CodegenGenerator) => void
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
		stringLiteralValueOptions: () => CodegenLiteralValueOptions
		/** Convert the internal IndexedObjectsType to an iterable of values */
		values: <T>(indexed: IndexedCollectionType<T>) => Iterable<T>
	}
}

export type CodegenGeneratorConstructor<C = CodegenGeneratorContext> = (config: CodegenConfig, context: C) => CodegenGenerator
