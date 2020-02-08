import { constantCase } from 'change-case'
import { pascalCase, camelCase, capitalize } from 'openapi-generator-node-core'
import { CodegenConfig, CodegenState, CodegenRootContext } from 'openapi-generator-node-core'
import { CodegenOptionsJava, CodegenRootContextJava, ConstantStyle } from './types'
import path from 'path'
import Handlebars, { HelperOptions } from 'handlebars'
import { promises as fs } from 'fs'
import * as _ from 'lodash'

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
	value = value.replace(/"/g, '\\"')
	return value
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function prepareApiContext(context: any, state: CodegenState, root?: CodegenRootContext): any {
	return {
		...context,
		...state.options,
		...root,
		// classname: config.toApiName(context.name),
	}
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

const JavaCodegenConfig: CodegenConfig = {
	toClassName: (name) => {
		return classCamelCase(name)
	},
	toIdentifier: (name) => {
		return identifierCamelCase(name)
	},
	toConstantName: (name, state) => {
		const constantStyle = (state.options as CodegenOptionsJava).constantStyle
		switch (constantStyle) {
			case ConstantStyle.allCaps:
				return constantCase(name).replace(/_/g, '')
			case ConstantStyle.camelCase:
				return identifierCamelCase(name)
			case ConstantStyle.snake:
				return constantCase(name)
			default:
				throw new Error(`Invalid valid for constantStyle: ${constantStyle}`)
		}
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
					return `${(state.options as CodegenOptionsJava).dateImplementation}.parse("${value}")`
				} else if (format === 'time') {
					return `${(state.options as CodegenOptionsJava).timeImplementation}.parse("${value}")`
				} else if (format === 'date-time') {
					return `${(state.options as CodegenOptionsJava).dateTimeImplementation}.parse("${value}")`
				} else {
					return `"${escapeString(value)}"`
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
		if (type === 'object' && modelNames) {
			let modelName = `${(state.options as CodegenOptionsJava).modelPackage}`
			for (const name of modelNames) {
				modelName += `.${state.config.toClassName(name, state)}`
			}
			return modelName
		}

		/* See https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#data-types */
		switch (type) {
			case 'integer': {
				if (format === 'int32' || format === undefined) {
					return !required ? 'java.lang.Integer' : 'int'
				} else if (format === 'int64') {
					return !required ? 'java.lang.Long' : 'long'
				} else {
					throw new Error(`Unsupported ${type} format: ${format}`)
				}
			}
			case 'number': {
				if (format === undefined) {
					return 'java.math.BigDecimal'
				} else if (format === 'float') {
					return !required ? 'java.lang.Float' : 'float'
				} else if (format === 'double') {
					return !required ? 'java.lang.Double' : 'double'
				} else {
					throw new Error(`Unsupported ${type} format: ${format}`)
				}
			}
			case 'string': {
				if (format === 'byte') {
					return !required ? 'java.lang.Byte' : 'byte'
				} else if (format === 'binary') {
					return 'java.lang.Object'
				} else if (format === 'date') {
					return (state.options as CodegenOptionsJava).dateImplementation
				} else if (format === 'time') {
					return (state.options as CodegenOptionsJava).timeImplementation
				} else if (format === 'date-time') {
					return (state.options as CodegenOptionsJava).dateTimeImplementation
				} else {
					return 'java.lang.String'
				}
			}
			case 'boolean': {
				return !required ? 'java.lang.Boolean' : 'boolean'
			}
			case 'object': {
				return 'java.lang.Object'
			}
			case 'file': {
				return 'java.io.InputStream'
			}
		}

		throw new Error(`Unsupported type name: ${type}`)
	},
	toNativeArrayType: (componentNativeType, required, uniqueItems) => {
		if (uniqueItems) {
			return `java.util.Set<${componentNativeType}>`
		} else {
			return `java.util.List<${componentNativeType}>`
		}
	},
	toNativeMapType: (keyNativeType, componentNativeType) => {
		return `java.util.Map<${keyNativeType}, ${componentNativeType}>`
	},
	toDefaultValue: (defaultValue, type, format, required, state) => {
		if (defaultValue !== undefined) {
			return state.config.toLiteral(defaultValue, type, format, required, state)
		}

		if (!required) {
			return 'null'
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
				return 'null'
		}

		throw new Error(`Unsupported type name: ${type}`)
	},
	options: (initialOptions): CodegenOptionsJava => {
		const packageName = initialOptions.package || 'com.example'
		return {
			apiPackage: `${packageName}`,
			apiServiceImplPackage: `${packageName}.impl`,
			modelPackage: `${packageName}.model`,
			invokerPackage: `${packageName}.app`,
			useBeanValidation: true,
			dateImplementation: initialOptions.dateImplementation || 'java.time.LocalDate',
			timeImplementation: initialOptions.timeImplementation || 'java.time.LocalTime',
			dateTimeImplementation: initialOptions.dateTimeImplementation || 'java.time.OffsetDateTime',
			constantStyle: ConstantStyle.snake,
			...initialOptions,
		}
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

		await loadTemplates(path.resolve(__dirname, '../templates'), hbs)

		const options: CodegenOptionsJava = state.options as CodegenOptionsJava
		const rootContext: CodegenRootContextJava = {
			generatorClass: 'openapi-generator-node',
			generatedDate: new Date().toISOString(),
		}

		const outputPath = commandLineOptions.output

		const apiPackagePath = packageToPath(options.apiPackage)
		for (const group of doc.groups) {
			await emit('api', `${outputPath}/${apiPackagePath}/${state.config.toClassName(group.name, state)}Api.java`, prepareApiContext(group, state, rootContext), true, hbs)
		}

		for (const group of doc.groups) {
			await emit('apiService', `${outputPath}/${apiPackagePath}/${state.config.toClassName(group.name, state)}ApiService.java`, prepareApiContext(group, state, rootContext), true, hbs)
		}

		const apiImplPackagePath = packageToPath(options.apiServiceImplPackage)
		for (const group of doc.groups) {
			await emit('apiServiceImpl', `${outputPath}/${apiImplPackagePath}/${state.config.toClassName(group.name, state)}ApiServiceImpl.java`, 
				prepareApiContext(group, state, rootContext), false, hbs)
		}

		const modelPackagePath = packageToPath(options.modelPackage)
		for (const model of doc.models) {
			const context = {
				models: [model],
			}
			await emit('model', `${outputPath}/${modelPackagePath}/${state.config.toClassName(model.name, state)}.java`, prepareApiContext(context, state, rootContext), true, hbs)
		}
	},
}

export default JavaCodegenConfig
