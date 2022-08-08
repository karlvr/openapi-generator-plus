import { CodegenBaseGeneratorConstructor, CodegenGenerator, CodegenGeneratorContext } from '@openapi-generator-plus/types'
import { stringLiteralValueOptions } from './utils'
import { CodegenNativeTypeImpl, CodegenTransformingNativeTypeImpl, CodegenComposingNativeTypeImpl } from './native-type'
import * as allOperationGroupingStrategies from './operation-grouping'
import * as idx from '@openapi-generator-plus/indexed-type'
import { defaultLog } from './logging'

/**
 * A partial generator implementation that should be the base of all generators.
 * This enables the core to introduce new CodegenGenerator methods and add default
 * implementations here, if appropriate.
 */
const baseGenerator: CodegenBaseGeneratorConstructor = function(config, context) {
	return {
		toEnumMemberName: (name) => context.generator().toConstantName(name),
		toIteratedSchemaName: (name, _, iteration) => `${name}${iteration + 1}`,
		checkAllOfInheritanceCompatibility: () => {
			return true
		},
		checkPropertyCompatibility: (parentProp, childProp) => {
			if (parentProp.type !== childProp.type) {
				return false
			}
			if (parentProp.format !== childProp.format) {
				return false
			}
			if (parentProp.required && !childProp.required) {
				return false
			}
			return true
		},
	}
}

export function createGeneratorContext(options?: Partial<CodegenGeneratorContext>): CodegenGeneratorContext {
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
		utils: {
			stringLiteralValueOptions: () => stringLiteralValueOptions(_generator!),
			values: idx.values,
		},
		log: defaultLog,
		...options,
	}
}
