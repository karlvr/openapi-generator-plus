import { camelCase } from './case-transforms'
import { CodegenOptions, CodegenGenerator } from './types'
import pluralize from 'pluralize'

/** Create a default operation name for operations that lack an operationId */
function defaultOperationName(path: string, method: string): string {
	/* Remove path variables from the path */
	const sanitisedPath = path.replace(/\{[^}]*\}/g, '')
	const combined = `${method.toLocaleLowerCase()}_${sanitisedPath}`
	const sanitizedCombined = combined.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+$/, '')
	return camelCase(sanitizedCombined)
}

/**
 * A partial generator implementation that should be the base of all generators.
 * This enables the core to introduce new CodegenGenerator methods and add default
 * implementations here, if appropriate.
 */
function baseGenerator<O extends CodegenOptions>(): Pick<CodegenGenerator<O>, 'toIteratedModelName' | 'toModelNameFromPropertyName' | 'toOperationName'> {
	return {
		toIteratedModelName: (name, _, iteration) => `${name}${iteration + 1}`,
		toModelNameFromPropertyName: (name, state) => {
			return state.generator.toClassName(pluralize.singular(name), state)
		},
		toOperationName: defaultOperationName,
	}
}

/**
 * The options given to a generator module function when it is constructed.
 */
export interface CodegenGeneratorOptions {
	baseGenerator: typeof baseGenerator
}

export type CodegenGeneratorConstructor<O extends CodegenOptions> = (generatorOptions: CodegenGeneratorOptions) => CodegenGenerator<O>

export function defaultGeneratorOptions(): CodegenGeneratorOptions {
	return {
		baseGenerator,
	}
}
