import { CodegenNativeType, CodegenNativeTypeTransformer, CodegenNativeTypeTransformers, CodegenNativeTypeComposer, CodegenNativeTypeComposers } from '@openapi-generator-plus/types'

/**
 * A `CodegenNativeType` implementation that wraps and transforms another `CodegenNativeType`.
 * Useful when composing types, and wanting to retain the original `CodegenNativeType` object
 * in case it changes.
 */
export class CodegenTransformingNativeTypeImpl implements CodegenNativeType {

	private wrapped: CodegenNativeType
	private transformer: CodegenNativeTypeTransformer

	public constructor(wrapped: CodegenNativeType, transformer: CodegenNativeTypeTransformer) {
		this.wrapped = wrapped
		this.transformer = transformer
	}
	
	public get nativeType() {
		return this.transformer(this.wrapped.nativeType) || this.wrapped.nativeType
	}

	public get wireType() {
		return this.wrapped.wireType && this.transformer(this.wrapped.wireType)
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
			return undefined
		}
	}

	public equals(other: CodegenNativeType | undefined): boolean {
		return other === this
	}

	public toString() {
		return this.nativeType
	}

	public transform(transformer: CodegenNativeTypeTransformer) {
		const saveTransformer = this.transformer
		this.transformer = (nativeTypeString) => {
			const t = saveTransformer(nativeTypeString)
			return t && transformer(t)
		}
	}
}
export class CodegenNativeTypeImpl implements CodegenNativeType {

	public nativeType: string
	public wireType?: string
	public literalType?: string
	public concreteType?: string
	public componentType?: CodegenNativeType

	public constructor(nativeType: string, additionalTypes?: {
		wireType?: string | null
		literalType?: string | null
		concreteType?: string | null
		componentType?: CodegenNativeType | null
	}) {
		this.nativeType = nativeType
		if (additionalTypes) {
			this.wireType = additionalTypes.wireType !== undefined ? additionalTypes.wireType !== null ? additionalTypes.wireType : undefined : nativeType
			this.literalType = additionalTypes.literalType !== undefined ? additionalTypes.literalType !== null ? additionalTypes.literalType : undefined : nativeType
			this.concreteType = additionalTypes.concreteType !== undefined ? additionalTypes.concreteType !== null ? additionalTypes.concreteType : undefined : nativeType
			this.componentType = additionalTypes.componentType !== undefined ? additionalTypes.componentType !== null ? additionalTypes.componentType : undefined : this
		} else {
			this.wireType = nativeType
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
		if (this.wireType !== other.wireType) {
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

	public transform(transformer: CodegenNativeTypeTransformer) {
		this.nativeType = transformer(this.nativeType)!
		this.wireType = this.wireType && transformer(this.wireType)
		this.literalType = this.literalType && transformer(this.literalType)
		this.concreteType = this.concreteType && transformer(this.concreteType)
		if (this.componentType && this.componentType !== this) {
			this.componentType = new CodegenTransformingNativeTypeImpl(this.componentType, transformer)
		}
	}
}

function allOrNothing(nativeTypes: (string | undefined)[]): string[] | undefined {
	const result = nativeTypes.filter(n => n !== undefined)
	if (result.length) {
		return result as string[]
	} else {
		return undefined
	}
}

export class CodegenComposingNativeTypeImpl implements CodegenNativeType {

	private wrapped: CodegenNativeType[]
	private composer: CodegenNativeTypeComposer

	public constructor(wrapped: CodegenNativeType[], composer: CodegenNativeTypeComposer) {
		this.wrapped = wrapped
		this.composer = composer
	}

	public get nativeType() {
		return this.composer(this.wrapped.map(n => n.nativeType)) || this.wrapped.map(n => n.nativeType).filter(n => !!n)[0]
	}

	public get wireType() {
		return this.compose(this.wrapped.map(n => n.wireType))
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
			return undefined
		}
	}

	public equals(other: CodegenNativeType | undefined): boolean {
		return other === this
	}

	public toString() {
		return this.nativeType
	}

	public transform() {
		throw new Error('Transforming not supported here yet')
	}

	private compose(nativeTypes: (string | undefined)[]): string | undefined {
		const filteredNativeTypes = allOrNothing(nativeTypes)
		return filteredNativeTypes && this.composer(filteredNativeTypes)
	}
}

export class CodegenFullTransformingNativeTypeImpl {

	private actualWrapped: CodegenNativeType
	private transformers: CodegenNativeTypeTransformers

	public constructor(wrapped: CodegenNativeType, transformers: CodegenNativeTypeTransformers) {
		this.actualWrapped = wrapped
		this.transformers = transformers
	}
	
	public get nativeType() {
		return this.transformers.nativeType(this.wrapped.nativeType) || this.wrapped.nativeType
	}

	public get wireType() {
		return this.wrapped.wireType && (this.transformers.wireType || this.transformers.nativeType)(this.wrapped.wireType)
	}

	public get literalType() {
		return this.wrapped.literalType && (this.transformers.literalType || this.transformers.nativeType)(this.wrapped.literalType)
	}

	public get concreteType() {
		return this.wrapped.concreteType && (this.transformers.concreteType || this.transformers.nativeType)(this.wrapped.concreteType)
	}

	public get componentType() {
		if (this.wrapped.componentType) {
			return new CodegenFullTransformingNativeTypeImpl(this.wrapped.componentType, this.transformers)
		} else {
			return undefined
		}
	}

	public equals(other: CodegenNativeType | undefined): boolean {
		return other === this
	}

	public toString() {
		return this.nativeType
	}

	public transform() {
		throw new Error('Transforming not supported here yet')
	}

	private get wrapped(): CodegenNativeType {
		if (this.transformers.transform) {
			return this.transformers.transform(this.actualWrapped)
		} else {
			return this.actualWrapped
		}
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
		return this.compose(this.wrapped.map(n => n.nativeType), this.composers.nativeType) || this.wrapped.map(n => n.nativeType).filter(n => !!n)[0]
	}

	public get wireType() {
		return this.compose(this.wrapped.map(n => n.wireType), this.composers.wireType || this.composers.nativeType)
	}

	public get literalType() {
		return this.compose(this.wrapped.map(n => n.literalType), this.composers.literalType || this.composers.nativeType)
	}

	public get concreteType() {
		return this.compose(this.wrapped.map(n => n.concreteType), this.composers.concreteType || this.composers.nativeType)
	}

	public get componentType() {
		const wrapped = this.wrapped
		const componentTypes = wrapped.map(n => n.componentType).filter(n => !!n) as CodegenNativeType[]
		if (componentTypes.length === wrapped.length) {
			return new CodegenFullComposingNativeTypeImpl(componentTypes, this.composers)
		} else {
			return undefined
		}
	}

	public equals(other: CodegenNativeType | undefined): boolean {
		return other === this
	}

	public toString() {
		return this.nativeType
	}

	public transform() {
		throw new Error('Transforming not supported here yet')
	}

	private compose(nativeTypes: (string | undefined)[], composer: CodegenNativeTypeComposer): string | undefined {
		const filteredNativeTypes = allOrNothing(nativeTypes)
		return filteredNativeTypes && composer(filteredNativeTypes)
	}

	private get wrapped(): CodegenNativeType[] {
		if (this.composers.transform) {
			return this.actualWrapped.map(this.composers.transform)
		} else {
			return this.actualWrapped
		}
	}

}
