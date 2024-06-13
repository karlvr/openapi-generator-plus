import { CodegenAllOfStrategy, CodegenAnyOfStrategy, CodegenGeneratorConstructor, CodegenGeneratorType, CodegenOneOfStrategy, CodegenOperationGroupingStrategy, CodegenSchemaPurpose, CodegenSchemaType } from '@openapi-generator-plus/types'
import { camelCase } from 'lodash'
import pluralize from 'pluralize'

interface TestCodegenOptions {
	config: TestCodegenConfig
}

export interface TestCodegenConfig {
	operationGroupingStrategy?: CodegenOperationGroupingStrategy
	allOfStrategy?: CodegenAllOfStrategy
	anyOfStrategy?: CodegenAnyOfStrategy
	oneOfStrategy?: CodegenOneOfStrategy
	supportsInheritance?: boolean
	supportsMultipleInheritance?: boolean
	expectLogWarnings?: boolean
	toSchemaName?: (name: string) => string
}

const testGeneratorConstructor: CodegenGeneratorConstructor = (config, generatorContext) => {
	const testConfig = config as TestCodegenConfig
	const generatorOptions: TestCodegenOptions = {
		config: testConfig,
	}

	return {
		...generatorContext.baseGenerator(config, generatorContext),
		generatorType: () => CodegenGeneratorType.SERVER,
		toClassName: (name) => `${name}_class`,
		toIdentifier: (name) => {
			if (name === 'type') {
				name = 'aType' /* Test reserved words */
			}
			return camelCase(`${name.replace(/[^a-zA-Z0-9_]/g, '_')}`)
		},
		toConstantName: (name) => `${name}_constant`,
		toEnumMemberName: (name) => `${name.replace('-', '')}_enum_member`,
		toOperationName: (path, method) => `${method} ${path.replace(/\{[^}]*\}/g, '').replace(/\/$/, '')} operation`,
		toOperationGroupName: (name) => `${name} api`,
		toSchemaName: (name) => {
			if (testConfig.toSchemaName) {
				return testConfig.toSchemaName(name)
			} else {
				return name
			}
		},
		toSuggestedSchemaName: (name, options) => {
			if (options.purpose === CodegenSchemaPurpose.ARRAY_ITEM || options.purpose === CodegenSchemaPurpose.MAP_VALUE) {
				name = pluralize.singular(name)
			}
			if (options.schemaType === CodegenSchemaType.ENUM) {
				return `${name}_enum`
			} else if (options.schemaType === CodegenSchemaType.OBJECT) {
				return `${name}_model`
			} else if (options.purpose === CodegenSchemaPurpose.INTERFACE) {
				return `i_${name}`
			} else if (options.purpose === CodegenSchemaPurpose.IMPLEMENTATION) {
				return `abstract_${name}`
			} else {
				return name
			}
		},
		toIteratedSchemaName: (name, _, iteration) => `${name}${iteration}`,
		toLiteral: (value) => {
			if (value === undefined || value === null) {
				return null
			} else if (typeof value === 'object') {
				return JSON.stringify(value)
			} else if (typeof value === 'string') {
				return `"${value}"`
			} else {
				return `${value}`
			}
		},
		toNativeType: (options) => new generatorContext.NativeType(options.type),
		toNativeObjectType: (options) => new generatorContext.NativeType(options.scopedName.join('.')),
		toNativeArrayType: (options) => new generatorContext.NativeType(`array ${options.componentNativeType}`),
		toNativeMapType: (options) => new generatorContext.NativeType(`map ${options.componentNativeType}`),
		nativeTypeUsageTransformer: () => ({
			default: (nativeType) => nativeType.nativeType,
		}),
		defaultValue: (options) => {
			if (!options.required) {
				return { value: undefined, literalValue: 'undefined' }
			}

			switch (options.schemaType) {
				case CodegenSchemaType.ARRAY:
					return { value: [], literalValue: '[]' }
				case CodegenSchemaType.OBJECT:
					return { value: {}, literalValue: '{}' }
				case CodegenSchemaType.NUMBER:
					return { value: 0.0, literalValue: '0.0' }
				case CodegenSchemaType.INTEGER:
					return { value: 0, literalValue: '0' }
				case CodegenSchemaType.BOOLEAN:
					return { value: false, literalValue: 'false' }
				default:
					return { value: undefined, literalValue: 'undefined' }
			}
		},
		initialValue: (options) => {
			/* Use the default value from the spec if available */
			if (options.defaultValue) {
				return options.defaultValue
			}

			if (!options.required) {
				return null
			}

			switch (options.schemaType) {
				case CodegenSchemaType.ARRAY:
					/* Initial blank array value for required array properties */
					return { value: [], literalValue: '[]' }
				case CodegenSchemaType.OBJECT:
					/* Initial empty object value for required object properties */
					return { value: {}, literalValue: '{}' }
				default:
					/* No initial values for other types */
					return null
			}
		},
		operationGroupingStrategy: () => generatorOptions.config.operationGroupingStrategy || generatorContext.operationGroupingStrategies.addToGroupsByPath,
		allOfStrategy: () => generatorOptions.config.allOfStrategy || CodegenAllOfStrategy.NATIVE,
		anyOfStrategy: () => generatorOptions.config.anyOfStrategy || CodegenAnyOfStrategy.NATIVE,
		oneOfStrategy: () => generatorOptions.config.oneOfStrategy || CodegenOneOfStrategy.NATIVE,
		supportsMultipleInheritance: () => generatorOptions.config.supportsMultipleInheritance || false,
		supportsInheritance: () => generatorOptions.config.supportsInheritance || false,
		nativeCompositionCanBeScope: () => true,
		nativeComposedSchemaRequiresName: () => true,
		nativeComposedSchemaRequiresObjectLikeOrWrapper: () => false,
		interfaceCanBeNested: () => true,
		exportTemplates: async() => {
			// NOOP
		},
		watchPaths: () => [],
		cleanPathPatterns: () => {
			/* So we trigger the clean function of the cli app */
			return ['test*']
		},
		templateRootContext: () => ({}),
	}
}

export default testGeneratorConstructor
