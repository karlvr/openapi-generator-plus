import { CodegenNativeType, CodegenSchema, CodegenSchemaUsage } from '@openapi-generator-plus/types'
import { CodegenTransformingNativeTypeImpl } from '../../native-type'
import { InternalCodegenState } from '../../types'
import { extractCodegenSchemaInfo } from '../utils'

export interface CreateSchemaUsageOptions {
	required: boolean
	nullable?: boolean
	readOnly?: boolean
	writeOnly?: boolean
}

export function createSchemaUsage<T extends CodegenSchema>(schema: T, options: CreateSchemaUsageOptions, state: InternalCodegenState): CodegenSchemaUsage<T> {
	const result: CodegenSchemaUsage<T> = {
		...extractCodegenSchemaInfo(schema),
		...options,
		schema,
		examples: null,
		defaultValue: null,
	}
	result.nativeType = transformNativeTypeForUsage(result, state)
	return result
}

export function transformNativeTypeForUsage(usage: CodegenSchemaUsage, state: InternalCodegenState): CodegenNativeType {
	const usageTransformer = state.generator.nativeTypeUsageTransformer(usage)
	return new CodegenTransformingNativeTypeImpl(usage.schema.nativeType, usageTransformer)
}
