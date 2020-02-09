import { constantCase } from 'change-case'
import { pascalCase, camelCase, capitalize, GroupingStrategies } from 'openapi-generator-node-core'
import { CodegenConfig, CodegenState, CodegenRootContext, CodegenNativeType } from 'openapi-generator-node-core'
import { CodegenOptionsTypescript, CodegenRootContextTypescript } from './types'
import path from 'path'
import Handlebars, { HelperOptions } from 'handlebars'
import { promises as fs } from 'fs'

async function compileTemplate(templatePath: string, hbs: typeof Handlebars) {
	const templateSource = await fs.readFile(templatePath, 'UTF-8')
	return hbs.compile(templateSource)
}

async function loadTemplates(templateDirPath: string, hbs: typeof Handlebars) {
	const files = await fs.readdir(templateDirPath)
	
	for (const file of files) {
		const template = await compileTemplate(path.resolve(templateDirPath, file), hbs)
		hbs.registerPartial(path.parse(file).name, template)
	}
}

/** Returns the string converted to a string that is safe as an identifier in most languages */
function identifierSafe(value: string) {
	/* Remove invalid leading characters */
	value = value.replace(/^[^a-zA-Z_]*/, '')

	/* Convert any illegal characters to underscores */
	value = value.replace(/[^a-zA-Z0-9_]/g, '_')

	return value
}

/**
 * Camel case and capitalize suitable for a class name. Doesn't change existing
 * capitalization in the value.
 * e.g. "FAQSection" remains "FAQSection", and "faqSection" will become "FaqSection" 
 * @param value string to be turned into a class name
 */
function classCamelCase(value: string) {
	return pascalCase(identifierSafe(value))
}

function identifierCamelCase(value: string) {
	return camelCase(identifierSafe(value))
}

function escapeString(value: string) {
	value = value.replace(/\\/g, '\\\\')
	value = value.replace(/'/g, '\\\'')
	return value
}

/**
 * Turns a Java package name into a path
 * @param packageName Java package name
 */
function packageToPath(packageName: string) {
	return packageName.replace(/\./g, path.sep)
}

async function emit(templateName: string, outputPath: string, context: object, replace: boolean, hbs: typeof Handlebars) {
	const template = hbs.partials[templateName]
	if (!template) {
		throw new Error(`Unknown template: ${templateName}`)
	}

	let outputString
	try {
		outputString = template(context)
	} catch (error) {
		console.error(`Failed to generate template "${templateName}"`, error)
		return
	}

	if (outputPath === '-') {
		console.log(outputString)
	} else {
		if (!replace) {
			try {
				await fs.access(outputPath)
				/* File exists, don't replace */
				return
			} catch (error) {
				/* Ignore, file doesn't exist */
			}
		}
		await fs.mkdir(path.dirname(outputPath), { recursive: true })
		fs.writeFile(outputPath, outputString, 'UTF-8')
	}
}

const config: CodegenConfig = {
	toClassName: (name) => {
		return classCamelCase(name)
	},
	toIdentifier: (name) => {
		return identifierCamelCase(name)
	},
	toConstantName: (name) => {
		return pascalCase(name)
	},
	toEnumName: (name) => {
		return classCamelCase(name) + 'Enum'
	},
	toOperationName: (path, method) => {
		return `${method.toLocaleLowerCase()}_${path}`
	},
	toLiteral: (value, type, format, required, state) => {
		if (value === undefined) {
			return state.config.toDefaultValue(undefined, type, format, required, state)
		}

		switch (type) {
			case 'integer': {
				if (format === 'int32' || format === undefined) {
					return !required ? `java.lang.Integer.valueOf(${value})` : `${value}`
				} else if (format === 'int64') {
					return !required ? `java.lang.Long.valueOf(${value}l)` : `${value}l`
				} else {
					throw new Error(`Unsupported ${type} format: ${format}`)
				}
			}
			case 'number': {
				if (format === undefined) {
					return `new java.math.BigDecimal("${value}")`
				} else if (format === 'float') {
					return !required ? `java.lang.Float.valueOf(${value}f)` : `${value}f`
				} else if (format === 'double') {
					return !required ? `java.lang.Double.valueOf(${value}d)` : `${value}d`
				} else {
					throw new Error(`Unsupported ${type} format: ${format}`)
				}
			}
			case 'string': {
				if (format === 'byte') {
					return !required ? `java.lang.Byte.valueOf(${value}b)` : `${value}b`
				} else if (format === 'binary') {
					throw new Error(`Cannot format literal for type ${type} format ${format}`)
				} else if (format === 'date') {
					return `java.time.LocalDate.parse("${value}")`
				} else if (format === 'time') {
					return `java.time.LocalTime.parse("${value}")`
				} else if (format === 'date-time') {
					return `java.time.OffsetDateTime.parse("${value}")`
				} else {
					return `'${escapeString(value)}'`
				}
			}
			case 'boolean':
				return !required ? `java.lang.Boolean.valueOf(${value})` : `${value}`
			case 'object':
			case 'file':
				throw new Error(`Cannot format literal for type ${type}`)
		}

		throw new Error(`Unsupported type name: ${type}`)
	},
	toNativeType: (type, format, required, modelNames, state) => {
		/* See https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#data-types */
		switch (type) {
			case 'integer': {
				return new CodegenNativeType('number')
			}
			case 'number': {
				return new CodegenNativeType('number')
			}
			case 'string': {
				switch (format) {
					case 'date':
					case 'time':
					case 'date-time':
						/* We don't have a mapping library to convert incoming and outgoing JSON, so the rawType of dates is string */
						return new CodegenNativeType('Date', 'string')
					default:
						return new CodegenNativeType('string')
				}
			}
			case 'boolean': {
				return new CodegenNativeType('boolean')
			}
			case 'object': {
				if (modelNames) {
					let modelName = ''
					for (const name of modelNames) {
						modelName += `.${state.config.toClassName(name, state)}`
					}
					return new CodegenNativeType(modelName.substring(1))
				} else {
					return new CodegenNativeType('object')
				}
			}
			case 'file': {
				/* JavaScript does have a File type, but it isn't supported by JSON serialization so we don't have a wireType */
				return new CodegenNativeType('File', null)
			}
		}

		throw new Error(`Unsupported type name: ${type}`)
	},
	toNativeArrayType: (componentNativeType) => {
		return new CodegenNativeType(`${componentNativeType}[]`, `${componentNativeType.wireType}[]`)
	},
	toNativeMapType: (keyNativeType, componentNativeType) => {
		return new CodegenNativeType(`{ [name: ${keyNativeType}]: ${componentNativeType} }`, `{ [name: ${keyNativeType.wireType}]: ${componentNativeType.wireType} }`)
	},
	toDefaultValue: (defaultValue, type, format, required, state) => {
		if (defaultValue !== undefined) {
			return state.config.toLiteral(defaultValue, type, format, required, state)
		}

		if (!required) {
			return 'undefined'
		}

		switch (type) {
			case 'integer':
			case 'number':
				return state.config.toLiteral(0, type, format, required, state)
			case 'boolean':
				return 'false'
			case 'string':
			case 'object':
			case 'array':
			case 'file':
				return 'undefined'
		}

		throw new Error(`Unsupported type name: ${type}`)
	},
	options: (initialOptions): CodegenOptionsTypescript => {
		const packageName = initialOptions.package || 'com.example'
		return {
			hideGenerationTimestamp: true,
			apiPackage: `${packageName}`,
			apiServiceImplPackage: `${packageName}.impl`,
			modelPackage: `${packageName}.model`,
			invokerPackage: `${packageName}.app`,
			useBeanValidation: true,
			...initialOptions,
		}
	},
	operationGroupingStrategy: () => {
		return GroupingStrategies.addToGroupsByTag
	},

	exportTemplates: async(doc, commandLineOptions, state) => {
		const hbs = Handlebars.create()
		const config = state.config

		/** Convert the string argument to a Java class name. */
		hbs.registerHelper('className', function(name: string) {
			if (typeof name === 'string') {
				return config.toClassName(name, state)
			} else {
				throw new Error(`className helper has invalid name parameter: ${name}`)
			}
		})
		/** Convert the given name to be a safe appropriately named identifier for the language */
		hbs.registerHelper('identifier', function(name: string) {
			if (typeof name === 'string') {
				return config.toIdentifier(name, state)
			} else {
				throw new Error(`identifier helper has invalid parameter: ${name}`)
			}
		})
		hbs.registerHelper('constantName', function(name: string) {
			if (typeof name === 'string') {
				return config.toConstantName(name, state)
			} else {
				throw new Error(`constantName helper has invalid parameter: ${name}`)
			}
		})
		// Handlebars.registerHelper('literal', function(value: any) {
		// 	if (value !== undefined) {
		// 		return new Handlebars.SafeString(config.toLiteral(value, state))
		// 	} else {
		// 		throw new Error(`literal helper has invalid parameter: ${value}`)
		// 	}
		// })
		hbs.registerHelper('capitalize', function(value: string) {
			return capitalize(value)
		})
		hbs.registerHelper('escapeString', function(value: string) {
			return escapeString(value)
		})
		// Handlebars.registerHelper('hasConsumes', function(this: any, options: HelperOptions) {
		// 	if (this.consumes) {
		// 		return options.fn({
		// 			...this,
		// 			consumes: this.consumes.map((mediaType: string) => ({ mediaType })),
		// 		})
		// 	} else {
		// 		return options.inverse(this)
		// 	}
		// })
		// Handlebars.registerHelper('hasProduces', function(this: any, options: HelperOptions) {
		// 	if (this.produces) {
		// 		return options.fn({
		// 			...this,
		// 			produces: this.produces.map((mediaType: string) => ({ mediaType })),
		// 		})
		// 	} else {
		// 		return options.inverse(this)
		// 	}
		// })
		// Handlebars.registerHelper('subresourceOperation', function(this: any, options: HelperOptions) {
		// 	if (this.path) {
		// 		return options.fn(this)
		// 	} else {
		// 		return options.inverse(this)
		// 	}
		// })
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		hbs.registerHelper('hasMore', function(this: any, options: HelperOptions) {
			if (options.data.last === false) {
				return options.fn(this)
			} else {
				return options.inverse(this)
			}
		})
		// Handlebars.registerHelper('dataType', function(this: any, name: string) {
		// 	/* Convert the given swagger type to a type appropriate to the language */
		// 	if (this.type) {
		// 		return new Handlebars.SafeString(config.toDataType(this.type, this.format, this.required, this.refName))
		// 	}
		// })
		// Handlebars.registerHelper('returnBaseType', function(this: CodegenOperationDetail, options: HelperOptions) {
		// 	// console.log('returnBaseType', options)
		// 	if (this.responses) {

		// 	}
		// 	if (options.fn) {
		// 		/* Block helper */
		// 		return options.fn(this)
		// 	} else {
		// 		return 'OK'
		// 	}
		// })
		// Handlebars.registerHelper('httpMethod', function(this: any, options: HelperOptions) {
		// 	console.log('HTTP METHOD', this)
		// 	return this.method
		// })
		// Handlebars.registerHelper('helperMissing', function(this: any) {
		// 	const options = arguments[arguments.length - 1];

		hbs.registerHelper('safe', function(value: string) {
			return new Handlebars.SafeString(value)
		})

		await loadTemplates(path.resolve(__dirname, '../templates'), hbs)

		const options: CodegenOptionsTypescript = state.options as CodegenOptionsTypescript
		const rootContext: CodegenRootContextTypescript = {
			generatorClass: 'openapi-generator-node',
			generatedDate: new Date().toISOString(),

			package: options.apiPackage,
		}

		const outputPath = commandLineOptions.output

		const apiPackagePath = packageToPath(rootContext.package)

		await emit('api', `${outputPath}/api.ts`, { ...doc, ...state.options, ...rootContext }, true, hbs)

		// for (const groupName in doc.groups) {
		// 	await emit('apiService', `${outputPath}/${apiPackagePath}/${state.config.toClassName(groupName, state)}ApiService.java`, prepareApiContext(doc.groups[groupName], state, rootContext), true, hbs)
		// }

		// rootContext.package = options.apiServiceImplPackage

		// const apiImplPackagePath = packageToPath(rootContext.package)
		// for (const groupName in doc.groups) {
		// 	await emit('apiServiceImpl', `${outputPath}/${apiImplPackagePath}/${state.config.toClassName(groupName, state)}ApiServiceImpl.java`, 
		// 		prepareApiContext(doc.groups[groupName], state, rootContext), false, hbs)
		// }

		// rootContext.package = options.modelPackage

		// const modelPackagePath = packageToPath(rootContext.package)
		// for (const modelName in doc.schemas) {
		// 	const context = {
		// 		models: {
		// 			model: [doc.schemas[modelName]],
		// 		},
		// 	}
		// 	await emit('model', `${outputPath}/${modelPackagePath}/${state.config.toClassName(modelName, state)}.java`, prepareApiContext(context, state, rootContext), true, hbs)
		// }

		// for (const modelName in state.anonymousModels) {
		// 	const context = {
		// 		models: {
		// 			model: [state.anonymousModels[modelName]],
		// 		},
		// 	}
		// 	await emit('model', `${outputPath}/${modelPackagePath}/${state.config.toClassName(modelName, state)}.java`, prepareApiContext(context, state, rootContext), true, hbs)
		// }
	},
}

export default config
