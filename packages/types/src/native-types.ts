import { CodegenNativeType, CodegenNativeTypeTransformer } from './types'

export type CodegenNativeTypeComposer = (nativeTypeStrings: string[]) => string | undefined

/**
 * A `CodegenNativeType` implementation that wraps and transforms another `CodegenNativeType`.
 * Useful when composing types, and wanting to retain the original `CodegenNativeType` object
 * in case it changes.
 */
export interface CodegenTransformingNativeTypeConstructor {
	new(nativeType: CodegenNativeType, transformer: CodegenNativeTypeTransformer): CodegenNativeType
}

export interface CodegenComposingNativeTypeConstructor {
	new(nativeTypes: CodegenNativeType[], composer: CodegenNativeTypeComposer): CodegenNativeType
}

export interface CodegenNativeTypeTransformers {
	nativeType: CodegenNativeTypeTransformer
	wireType?: CodegenNativeTypeTransformer
	literalType?: CodegenNativeTypeTransformer
	concreteType?: CodegenNativeTypeTransformer
	transform?: (nativeType: CodegenNativeType) => CodegenNativeType
}

export interface CodegenFullTransformingNativeTypeConstructor {
	new(nativeType: CodegenNativeType, transformers: CodegenNativeTypeTransformers): CodegenNativeType
}

export interface CodegenNativeTypeComposers {
	nativeType: CodegenNativeTypeComposer
	wireType?: CodegenNativeTypeComposer
	literalType?: CodegenNativeTypeComposer
	concreteType?: CodegenNativeTypeComposer
	transform?: (nativeType: CodegenNativeType) => CodegenNativeType
}

export interface CodegenFullComposingNativeTypeConstructor {
	new(nativeTypes: CodegenNativeType[], composers: CodegenNativeTypeComposers): CodegenNativeType
}
