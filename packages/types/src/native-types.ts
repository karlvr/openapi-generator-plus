import { CodegenNativeType } from './types'

export type CodegenNativeTypeStringComposer = (nativeTypeStrings: string[]) => string | undefined
export type CodegenNativeTypeComposer = (nativeTypes: CodegenNativeType[]) => string | undefined

/** Simple transformer on a native type string */
export type CodegenNativeTypeStringTransformer = (nativeTypeString: string) => string | undefined

/**  */
export type CodegenNativeTypeTransformer = (nativeType: CodegenNativeType) => string | undefined

/**
 * A `CodegenNativeType` implementation that wraps and transforms another `CodegenNativeType`.
 * Useful when composing types, and wanting to retain the original `CodegenNativeType` object
 * in case it changes.
 */
export interface CodegenTransformingNativeTypeConstructor {
	new(nativeType: CodegenNativeType, transformer: CodegenNativeTypeStringTransformer): CodegenNativeType
}

export interface CodegenComposingNativeTypeConstructor {
	new(nativeTypes: CodegenNativeType[], composer: CodegenNativeTypeStringComposer): CodegenNativeType
}

export interface CodegenNativeTypeTransformers {
	nativeType: CodegenNativeTypeTransformer
	serializedType?: CodegenNativeTypeTransformer
	literalType?: CodegenNativeTypeTransformer
	concreteType?: CodegenNativeTypeTransformer
}

export interface CodegenFullTransformingNativeTypeConstructor {
	new(nativeType: CodegenNativeType, transformers: CodegenNativeTypeTransformers): CodegenNativeType
}

export interface CodegenNativeTypeComposers {
	nativeType: CodegenNativeTypeComposer
	serializedType?: CodegenNativeTypeComposer
	literalType?: CodegenNativeTypeComposer
	concreteType?: CodegenNativeTypeComposer
}

export interface CodegenFullComposingNativeTypeConstructor {
	new(nativeTypes: CodegenNativeType[], composers: CodegenNativeTypeComposers): CodegenNativeType
}
