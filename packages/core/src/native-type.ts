import { CodegenNativeType, CodegenNativeTypeTransformers, CodegenNativeTypeComposers, CodegenNativeTypeComposer, CodegenNativeTypeInfo } from '@openapi-generator-plus/types'

export class CodegenNativeTypeImpl implements CodegenNativeType {

	public nativeType: string
	public serializedType: string
	public literalType: string
	public concreteType: string
	public parentType: string
	public componentType: CodegenNativeType | null
	private infoValue: CodegenNativeTypeInfo | null

	public constructor(nativeType: string, additionalTypes?: {
		serializedType?: string
		literalType?: string
		concreteType?: string
		parentType?: string
		componentType?: CodegenNativeType | null
		info?: CodegenNativeTypeInfo
	}) {
		this.nativeType = nativeType
		if (additionalTypes) {
			this.serializedType = additionalTypes.serializedType !== undefined ? additionalTypes.serializedType : nativeType
			this.literalType = additionalTypes.literalType !== undefined ? additionalTypes.literalType : nativeType
			this.concreteType = additionalTypes.concreteType !== undefined ? additionalTypes.concreteType : nativeType
			this.parentType = additionalTypes.parentType !== undefined ? additionalTypes.parentType : nativeType
			this.componentType = additionalTypes.componentType !== undefined ? additionalTypes.componentType : null
			this.infoValue = additionalTypes.info !== undefined ? additionalTypes.info : null
		} else {
			this.serializedType = nativeType
			this.literalType = nativeType
			this.concreteType = nativeType
			this.parentType = nativeType
			this.componentType = null
			this.infoValue = null
		}
	}

	public get info() {
		/* We provide this getter to ensure that our info remains immutable */
		if (this.infoValue) {
			return { ...this.infoValue }
		} else {
			return null
		}
	}

	public toString() {
		return this.nativeType
	}

	public equals(other: CodegenNativeType | undefined): boolean {
		return equalNativeType(this, other)
	}

}

export class CodegenTransformingNativeTypeImpl implements CodegenNativeType {

	private actualWrapped: CodegenNativeType
	private transformers: CodegenNativeTypeTransformers

	public constructor(wrapped: CodegenNativeType, transformers: CodegenNativeTypeTransformers) {
		this.actualWrapped = wrapped
		this.transformers = transformers
	}
	
	public get nativeType() {
		const transformer = this.transformers.nativeType || this.transformers.default
		if (transformer) {
			return transformer(this.wrapped, this.wrapped.nativeType) || this.wrapped.nativeType
		} else {
			return this.wrapped.nativeType
		}
	}

	public get serializedType() {
		const transformer = this.transformers.serializedType !== undefined ? this.transformers.serializedType : this.transformers.default
		if (transformer) {
			return transformer(this.wrapped, this.wrapped.serializedType)
		} else {
			return this.wrapped.serializedType
		}
	}

	public get literalType() {
		const transformer = this.transformers.literalType !== undefined ? this.transformers.literalType : this.transformers.default
		if (transformer) {
			return transformer(this.wrapped, this.wrapped.literalType)
		} else {
			return this.wrapped.literalType
		}
	}

	public get concreteType() {
		const transformer = this.transformers.concreteType !== undefined ? this.transformers.concreteType : this.transformers.default
		if (transformer) {
			return transformer(this.wrapped, this.wrapped.concreteType)
		} else {
			return this.wrapped.concreteType
		}
	}

	public get parentType() {
		const transformer = this.transformers.parentType !== undefined ? this.transformers.parentType : this.transformers.default
		if (transformer) {
			return transformer(this.wrapped, this.wrapped.parentType)
		} else {
			return this.wrapped.parentType
		}
	}

	public get componentType(): CodegenNativeType | null {
		const transformers = this.transformers.componentType !== undefined ? this.transformers.componentType : this.transformers
		if (transformers) {
			return new CodegenTransformingNativeTypeImpl(this.wrapped.componentType || this.wrapped, transformers)
		} else {
			return this.wrapped.componentType
		}
	}

	public get info(): CodegenNativeTypeInfo | null {
		const transformer = this.transformers.info !== undefined ? this.transformers.info : (nativeType: CodegenNativeType) => nativeType.info
		if (transformer) {
			/* We must create a new object to prevent modifications to the wrapped info */
			return transformer(this.wrapped)
		} else {
			return this.wrapped.info
		}
	}

	private get wrapped(): CodegenNativeType {
		return this.actualWrapped
	}

	public equals(other: CodegenNativeType | undefined): boolean {
		return equalNativeType(this, other)
	}

	public toString() {
		return this.nativeType
	}
	
}

export class CodegenComposingNativeTypeImpl implements CodegenNativeType {

	private actualWrapped: CodegenNativeType[]
	private composers: CodegenNativeTypeComposers

	public constructor(wrapped: CodegenNativeType[], composers: CodegenNativeTypeComposers) {
		this.actualWrapped = wrapped
		this.composers = composers
	}

	public get nativeType() {
		return this.compose(this.wrapped, this.composers.nativeType || this.composers.default) || this.wrapped.map(n => n.nativeType).filter(n => !!n)[0]
	}

	public get serializedType() {
		return this.compose(this.wrapped, this.composers.serializedType || this.composers.default)
	}

	public get literalType() {
		return this.compose(this.wrapped, this.composers.literalType || this.composers.default)
	}

	public get concreteType() {
		return this.compose(this.wrapped, this.composers.concreteType || this.composers.default)
	}

	public get parentType() {
		return this.compose(this.wrapped, this.composers.parentType || this.composers.default)
	}

	public get componentType(): CodegenNativeType | null {
		const wrapped = this.wrapped
		const componentTypes = wrapped.map(n => n.componentType).filter(n => !!n) as CodegenNativeType[]
		if (componentTypes.length === wrapped.length) {
			return new CodegenComposingNativeTypeImpl(componentTypes, this.composers)
		} else {
			return null
		}
	}
	

	/**
	 * The default composing of `info` is to combine left to right.
	 */
	public get info(): CodegenNativeTypeInfo | null {
		if (this.composers.info) {
			return this.composers.info(this.wrapped, defaultCodegenNativeTypeInfoComposer)
		} else {
			return defaultCodegenNativeTypeInfoComposer(this.wrapped)
		}
	}

	private get wrapped(): CodegenNativeType[] {
		return this.actualWrapped
	}

	public equals(other: CodegenNativeType | undefined): boolean {
		return equalNativeType(this, other)
	}

	public toString() {
		return this.nativeType
	}

	private compose(nativeTypes: CodegenNativeType[], composer: CodegenNativeTypeComposer): string {
		return composer(nativeTypes)
	}

}

function defaultCodegenNativeTypeInfoComposer(nativeTypes: CodegenNativeType[]): CodegenNativeTypeInfo | null {
	let result: CodegenNativeTypeInfo | null = null
	for (const nativeType of nativeTypes) {
		if (nativeType.info) {
			if (!result) {
				result = {}
			}
			Object.assign(result, nativeType.info)
		}
	}
	return result
}

function equalNativeType(a: CodegenNativeType, b: CodegenNativeType | undefined): boolean {
	if (!b) {
		return false
	}

	if (a.nativeType !== b.nativeType) {
		return false
	}
	if (a.serializedType !== b.serializedType) {
		return false
	}
	if (a.literalType !== b.literalType) {
		return false
	}
	if (a.concreteType !== b.concreteType) {
		return false
	}
	if (a.parentType !== b.parentType) {
		return false
	}
	if (a.componentType !== b.componentType) {
		return false
	}
	
	return true
}
