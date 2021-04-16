import { CodegenNativeType } from './types'

export type CodegenNativeTypeStringComposer = (nativeTypeStrings: string[]) => string | null
export type CodegenNativeTypeComposer = (nativeTypes: CodegenNativeType[]) => string | null

/**
 * Simple transformer on a native type string.
 * @returns a new native type string, or `null` to remove the native type.
 */
export type CodegenNativeTypeStringTransformer = (nativeTypeString: string) => string | null

/**
 * Transform the given native type.
 * @returns a new native type string, or `null` to remove the native type.
 */
export type CodegenNativeTypeTransformer = (nativeType: CodegenNativeType, nativeTypeString: string) => string | null

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
	default?: CodegenNativeTypeTransformer
	nativeType?: CodegenNativeTypeTransformer | null
	serializedType?: CodegenNativeTypeTransformer | null
	literalType?: CodegenNativeTypeTransformer | null
	parentType?: CodegenNativeTypeTransformer | null
	concreteType?: CodegenNativeTypeTransformer | null
	/**
	 * The transformer for the component type, or `null` if the component type shouldn't be transformed.
	 * If undefined, the component type is transformed using this set of transformers.
	 */
	componentType?: CodegenNativeTypeTransformers | null
}

export interface CodegenFullTransformingNativeTypeConstructor {
	new(nativeType: CodegenNativeType, transformers: CodegenNativeTypeTransformers): CodegenNativeType
}

export interface CodegenNativeTypeComposers {
	default: CodegenNativeTypeComposer
	nativeType?: CodegenNativeTypeComposer
	serializedType?: CodegenNativeTypeComposer
	literalType?: CodegenNativeTypeComposer
	parentType?: CodegenNativeTypeComposer
	concreteType?: CodegenNativeTypeComposer
}

export interface CodegenFullComposingNativeTypeConstructor {
	new(nativeTypes: CodegenNativeType[], composers: CodegenNativeTypeComposers): CodegenNativeType
}
