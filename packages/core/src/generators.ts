import { CodegenBaseGeneratorConstructor, CodegenGeneratorOptions } from '@openapi-generator-plus/types'
import pluralize from 'pluralize'
import { InvalidModelError } from './process'
import { stringLiteralValueOptions } from './utils'
import { CodegenNativeTypeImpl, CodegenTransformingNativeTypeImpl, CodegenComposingNativeTypeImpl, CodegenFullTransformingNativeTypeImpl, CodegenFullComposingNativeTypeImpl } from './native-type'

/**
 * A partial generator implementation that should be the base of all generators.
 * This enables the core to introduce new CodegenGenerator methods and add default
 * implementations here, if appropriate.
 */
const baseGenerator: CodegenBaseGeneratorConstructor = function() {
	return {
		toEnumMemberName: (name, state) => state.generator.toConstantName(name, state),
		toIteratedModelName: (name, _, iteration) => `${name}${iteration + 1}`,
		toModelNameFromPropertyName: (name, state) => {
			return state.generator.toClassName(pluralize.singular(name), state)
		},
	}
}

export function defaultGeneratorOptions<O>(): CodegenGeneratorOptions {
	return {
		baseGenerator,
		InvalidModelError: InvalidModelError as ErrorConstructor,
		NativeType: CodegenNativeTypeImpl,
		TransformingNativeType: CodegenTransformingNativeTypeImpl,
		ComposingNativeType: CodegenComposingNativeTypeImpl,
		FullTransformingNativeType: CodegenFullTransformingNativeTypeImpl,
		FullComposingNativeType: CodegenFullComposingNativeTypeImpl,
		utils: {
			stringLiteralValueOptions,
		},
	}
}
