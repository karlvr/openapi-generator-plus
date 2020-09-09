import { CodegenBaseGeneratorConstructor, CodegenGeneratorContext } from '@openapi-generator-plus/types'
import { stringLiteralValueOptions } from './utils'
import { CodegenNativeTypeImpl, CodegenTransformingNativeTypeImpl, CodegenComposingNativeTypeImpl, CodegenFullTransformingNativeTypeImpl, CodegenFullComposingNativeTypeImpl } from './native-type'
import * as allOperationGroupingStrategies from './operation-grouping'
import * as idx from '@openapi-generator-plus/indexed-type'

/**
 * A partial generator implementation that should be the base of all generators.
 * This enables the core to introduce new CodegenGenerator methods and add default
 * implementations here, if appropriate.
 */
const baseGenerator: CodegenBaseGeneratorConstructor = function() {
	return {
		toEnumMemberName: (name, state) => state.generator.toConstantName(name, state),
		toIteratedModelName: (name, _, iteration) => `${name}${iteration + 1}`,
	}
}

export function defaultGeneratorOptions<O>(): CodegenGeneratorContext {
	return {
		baseGenerator,
		operationGroupingStrategies: allOperationGroupingStrategies,
		NativeType: CodegenNativeTypeImpl,
		TransformingNativeType: CodegenTransformingNativeTypeImpl,
		ComposingNativeType: CodegenComposingNativeTypeImpl,
		FullTransformingNativeType: CodegenFullTransformingNativeTypeImpl,
		FullComposingNativeType: CodegenFullComposingNativeTypeImpl,
		utils: {
			stringLiteralValueOptions,
			values: idx.values,
		},
	}
}
