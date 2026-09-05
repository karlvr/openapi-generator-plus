import { CodegenLogLevel, CodegenNativeType, CodegenSchema, CodegenSchemaUsage } from '@openapi-generator-plus/types'
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

/**
 * Remove the nullability from a schema usage whose serialized form cannot express null, and warn
 * about it. Use this when the usage becomes text in a URL or in a header. Such a form has no null,
 * and OpenAPI does not define how to send one. A receiver also cannot tell null from an empty
 * value, so the nullability cannot survive a round trip.
 *
 * The usage changes in place, and its native type loses null. The schema keeps its nullability,
 * because another usage of the same schema can express it.
 *
 * `context` names the thing that carries the usage, for the warning message.
 */
export function ignoreNullability(usage: CodegenSchemaUsage, context: string, state: InternalCodegenState): void {
	if (!usage.nullable) {
		return
	}

	state.log(CodegenLogLevel.WARN, `${context} is nullable, but OpenAPI does not define how to send null in a parameter or a header. Ignoring the nullability.`)
	usage.nullable = false
	usage.nativeType = transformNativeTypeForUsage(usage, state)
}
