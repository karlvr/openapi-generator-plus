import { CodegenGenerator, CodegenGeneratorOptions } from '@openapi-generator-plus/types'
import pluralize from 'pluralize'
import { InvalidModelError } from './process'
import { stringLiteralValueOptions } from './utils'
import CodegenNativeTypeImpl from './native-type'

/**
 * A partial generator implementation that should be the base of all generators.
 * This enables the core to introduce new CodegenGenerator methods and add default
 * implementations here, if appropriate.
 */
function baseGenerator<O>(): Pick<CodegenGenerator<O>, 'toIteratedModelName' | 'toModelNameFromPropertyName'> {
	return {
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
		utils: {
			stringLiteralValueOptions,
		},
	}
}
