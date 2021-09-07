import { CodegenNativeType } from './types'

export type CodegenNativeTypeStringComposer = (nativeTypeStrings: string[]) => string
export type CodegenNativeTypeComposer = (nativeTypes: CodegenNativeType[]) => string

/**
 * Transform the given native type.
 * @param nativeType the native type
 * @param nativeTypeString the string value of the particular property of the nativeType that is requested to be transformed
 * @returns a new native type string, or `null` to remove the native type.
 */
export type CodegenNativeTypeTransformer = (nativeType: CodegenNativeType, nativeTypeString: string) => string

export interface CodegenNativeTypeTransformers {
	/**
	 * Implement the default transformer if you don't need to know which CodegenNativeType property is being transformed,
	 * or if you can just use the nativeTypeString parameter.
	 * 
	 * Otherwise implement a specific transformer method.
	 */
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

export interface CodegenTransformingNativeTypeConstructor {
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

export interface CodegenComposingNativeTypeConstructor {
	new(nativeTypes: CodegenNativeType[], composers: CodegenNativeTypeComposers): CodegenNativeType
}
