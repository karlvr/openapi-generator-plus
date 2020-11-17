import { CodegenBaseGeneratorConstructor, CodegenGenerator, CodegenGeneratorContext } from '@openapi-generator-plus/types'
import { stringLiteralValueOptions } from './utils'
import { CodegenNativeTypeImpl, CodegenTransformingNativeTypeImpl, CodegenComposingNativeTypeImpl, CodegenFullTransformingNativeTypeImpl, CodegenFullComposingNativeTypeImpl } from './native-type'
import * as allOperationGroupingStrategies from './operation-grouping'
import * as idx from '@openapi-generator-plus/indexed-type'

/**
 * A partial generator implementation that should be the base of all generators.
 * This enables the core to introduce new CodegenGenerator methods and add default
 * implementations here, if appropriate.
 */
const baseGenerator: CodegenBaseGeneratorConstructor = function(config, context) {
	return {
		toEnumMemberName: (name) => context.generator().toConstantName(name),
		toIteratedModelName: (name, _, iteration) => `${name}${iteration + 1}`,
	}
}

export function defaultGeneratorOptions(): CodegenGeneratorContext {
	let _generator: CodegenGenerator | undefined
	return {
		generator: () => {
			if (_generator) {
				return _generator
			}
			throw new Error('CodegenGenerator not yet set')
		},
		setGenerator: (generator) => {
			_generator = generator
		},
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
