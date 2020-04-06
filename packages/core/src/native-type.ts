import { CodegenNativeType } from '@openapi-generator-plus/types'

export default class CodegenNativeTypeImpl implements CodegenNativeType {

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
		return this.nativeType === other.nativeType && this.wireType === other.wireType && this.literalType === other.literalType
	}
}
