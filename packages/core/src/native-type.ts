import { CodegenNativeType, CodegenNativeTypeStringTransformer, CodegenNativeTypeTransformers, CodegenNativeTypeStringComposer, CodegenNativeTypeComposers, CodegenNativeTypeComposer } from '@openapi-generator-plus/types'

/**
 * A `CodegenNativeType` implementation that wraps and transforms another `CodegenNativeType`.
 * Useful when composing types, and wanting to retain the original `CodegenNativeType` object
 * in case it changes.
 */
export class CodegenTransformingNativeTypeImpl implements CodegenNativeType {

	private wrapped: CodegenNativeType
	private transformer: CodegenNativeTypeStringTransformer

	public constructor(wrapped: CodegenNativeType, transformer: CodegenNativeTypeStringTransformer) {
		this.wrapped = wrapped
		this.transformer = transformer
	}
	
	public get nativeType() {
		return this.transformer(this.wrapped.nativeType) || this.wrapped.nativeType
	}

	public get serializedType() {
		return this.wrapped.serializedType && this.transformer(this.wrapped.serializedType)
	}

	public get literalType() {
		return this.wrapped.literalType && this.transformer(this.wrapped.literalType)
	}

	public get concreteType() {
		return this.wrapped.concreteType && this.transformer(this.wrapped.concreteType)
	}

	public get componentType() {
		if (this.wrapped.componentType) {
			return new CodegenTransformingNativeTypeImpl(this.wrapped.componentType, this.transformer)
		} else {
			return null
		}
	}

	public equals(other: CodegenNativeType | undefined): boolean {
		return other === this
	}

	public toString() {
		return this.nativeType
	}

}
export class CodegenNativeTypeImpl implements CodegenNativeType {

	public nativeType: string
	public serializedType: string | null
	public literalType: string | null
	public concreteType: string | null
	public componentType: CodegenNativeType | null

	public constructor(nativeType: string, additionalTypes?: {
		serializedType?: string | null
		literalType?: string | null
		concreteType?: string | null
		componentType?: CodegenNativeType | null
	}) {
		this.nativeType = nativeType
		if (additionalTypes) {
			this.serializedType = additionalTypes.serializedType !== undefined ? additionalTypes.serializedType : nativeType
			this.literalType = additionalTypes.literalType !== undefined ? additionalTypes.literalType : nativeType
			this.concreteType = additionalTypes.concreteType !== undefined ? additionalTypes.concreteType : nativeType
			this.componentType = additionalTypes.componentType !== undefined ? additionalTypes.componentType : this
		} else {
			this.serializedType = nativeType
			this.literalType = nativeType
			this.concreteType = nativeType
			this.componentType = this
		}
	}

	public toString() {
		return this.nativeType
	}

	public equals(other: CodegenNativeType | undefined): boolean {
		if (!other) {
			return false
		}

		if (this.nativeType !== other.nativeType) {
			return false
		}
		if (this.serializedType !== other.serializedType) {
			return false
		}
		if (this.literalType !== other.literalType) {
			return false
		}
		if (this.concreteType !== other.concreteType) {
			return false
		}
		if (this.componentType === other.componentType || (this.componentType === this && other.componentType === other)) {
			/* okay */
		} else if (!this.componentType || !other.componentType) {
			return false
		} else {
			if (this.componentType !== this || other.componentType !== other) {
				/* Component type is not recursive */
				if (!this.componentType.equals(other.componentType)) {
					return false
				}
			}
		}
		
		return true
	}

}

function allOrNothing<T>(nativeTypes: (T | null | undefined)[]): T[] | null {
	const result = nativeTypes.filter(n => n !== undefined && n !== null)
	if (result.length) {
		return result as T[]
	} else {
		return null
	}
}

export class CodegenComposingNativeTypeImpl implements CodegenNativeType {

	private wrapped: CodegenNativeType[]
	private composer: CodegenNativeTypeStringComposer

	public constructor(wrapped: CodegenNativeType[], composer: CodegenNativeTypeStringComposer) {
		this.wrapped = wrapped
		this.composer = composer
	}

	public get nativeType() {
		return this.composer(this.wrapped.map(n => n.nativeType)) || this.wrapped.map(n => n.nativeType).filter(n => !!n)[0]
	}

	public get serializedType() {
		return this.compose(this.wrapped.map(n => n.serializedType))
	}

	public get literalType() {
		return this.compose(this.wrapped.map(n => n.literalType))
	}

	public get concreteType() {
		return this.compose(this.wrapped.map(n => n.concreteType))
	}

	public get componentType() {
		const componentTypes = this.wrapped.map(n => n.componentType).filter(n => !!n) as CodegenNativeType[]
		if (componentTypes.length === this.wrapped.length) {
			return new CodegenComposingNativeTypeImpl(componentTypes, this.composer)
		} else {
			return null
		}
	}

	public equals(other: CodegenNativeType | undefined): boolean {
		return other === this
	}

	public toString() {
		return this.nativeType
	}

	private compose(nativeTypeStrings: (string | null)[]): string | null {
		const filteredNativeTypes = allOrNothing(nativeTypeStrings)
		return filteredNativeTypes && this.composer(filteredNativeTypes)
	}
}

export class CodegenFullTransformingNativeTypeImpl implements CodegenNativeType {

	private actualWrapped: CodegenNativeType
	private transformers: CodegenNativeTypeTransformers

	public constructor(wrapped: CodegenNativeType, transformers: CodegenNativeTypeTransformers) {
		this.actualWrapped = wrapped
		this.transformers = transformers
	}
	
	public get nativeType() {
		return this.transformers.nativeType(this.wrapped) || this.wrapped.nativeType
	}

	public get serializedType() {
		return this.wrapped.serializedType && (this.transformers.serializedType || this.transformers.nativeType)(this.wrapped)
	}

	public get literalType() {
		return this.wrapped.literalType && (this.transformers.literalType || this.transformers.nativeType)(this.wrapped)
	}

	public get concreteType() {
		return this.wrapped.concreteType && (this.transformers.concreteType || this.transformers.nativeType)(this.wrapped)
	}

	public get componentType() {
		if (this.wrapped.componentType) {
			return new CodegenFullTransformingNativeTypeImpl(this.wrapped.componentType, this.transformers)
		} else {
			return null
		}
	}

	public equals(other: CodegenNativeType | undefined): boolean {
		return other === this
	}

	public toString() {
		return this.nativeType
	}

	private get wrapped(): CodegenNativeType {
		return this.actualWrapped
	}
}

export class CodegenFullComposingNativeTypeImpl implements CodegenNativeType {

	private actualWrapped: CodegenNativeType[]
	private composers: CodegenNativeTypeComposers

	public constructor(wrapped: CodegenNativeType[], composers: CodegenNativeTypeComposers) {
		this.actualWrapped = wrapped
		this.composers = composers
	}

	public get nativeType() {
		return this.compose(this.wrapped, this.composers.nativeType) || this.wrapped.map(n => n.nativeType).filter(n => !!n)[0]
	}

	public get serializedType() {
		return this.compose(this.wrapped, this.composers.serializedType || this.composers.nativeType)
	}

	public get literalType() {
		return this.compose(this.wrapped, this.composers.literalType || this.composers.nativeType)
	}

	public get concreteType() {
		return this.compose(this.wrapped, this.composers.concreteType || this.composers.nativeType)
	}

	public get componentType() {
		const wrapped = this.wrapped
		const componentTypes = wrapped.map(n => n.componentType).filter(n => !!n) as CodegenNativeType[]
		if (componentTypes.length === wrapped.length) {
			return new CodegenFullComposingNativeTypeImpl(componentTypes, this.composers)
		} else {
			return null
		}
	}

	public equals(other: CodegenNativeType | undefined): boolean {
		return other === this
	}

	public toString() {
		return this.nativeType
	}

	private compose(nativeTypes: CodegenNativeType[], composer: CodegenNativeTypeComposer): string | null {
		const filteredNativeTypes = allOrNothing(nativeTypes)
		return filteredNativeTypes && composer(nativeTypes)
	}

	private get wrapped(): CodegenNativeType[] {
		return this.actualWrapped
	}

}
