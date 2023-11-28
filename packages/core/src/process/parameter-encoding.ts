import { CodegenEncodingStyle, CodegenParameterEncoding, CodegenParameterIn } from '@openapi-generator-plus/types'
import type { OpenAPI } from 'openapi-types'
import { isOpenAPIV2ItemsObject, isOpenAPIV2Parameter } from '../openapi-type-guards'
import { InternalCodegenState } from '../types'
import { OpenAPIX } from '../types/patches'
import { convertToBoolean } from './utils'

export function toCodegenParameterEncoding(parameter: Exclude<OpenAPI.Parameter, OpenAPIX.ReferenceObject>, state: InternalCodegenState): CodegenParameterEncoding {
	return parameterEncoding(parameter.name, parameter, parameter.in as CodegenParameterIn, 'parameter', state)
}

export function toCodegenHeaderEncoding(name: string, header: Exclude<OpenAPIX.Header, OpenAPIX.ReferenceObject>, state: InternalCodegenState): CodegenParameterEncoding {
	return parameterEncoding(name, header, 'header', 'header', state)
}

function parameterEncoding(name: string, parameter: Exclude<OpenAPI.Parameter | OpenAPIX.Header, OpenAPIX.ReferenceObject>, parameterIn: CodegenParameterIn, source: 'parameter' | 'header', state: InternalCodegenState): CodegenParameterEncoding {
	if (isOpenAPIV2Parameter(parameter, state.specVersion) || isOpenAPIV2ItemsObject(parameter, state.specVersion)) {
		switch (parameter.collectionFormat || 'csv') { /* The default collection format is csv */
			case 'csv': {
				if (parameterIn === 'path' || parameterIn === 'header') {
					return {
						style: CodegenEncodingStyle.SIMPLE,
						explode: false,
						allowReserved: false,
						allowEmptyValue: false,
					}
				} else {
					return {
						style: CodegenEncodingStyle.FORM,
						explode: false,
						allowReserved: false,
						allowEmptyValue: false,
					}
				}
			}
			case 'ssv': return {
				style: CodegenEncodingStyle.SPACE_DELIMITED,
				explode: false,
				allowReserved: false,
				allowEmptyValue: false,
			}
			case 'pipes': return {
				style: CodegenEncodingStyle.PIPE_DELIMITED,
				explode: false,
				allowReserved: false,
				allowEmptyValue: false,
			}
			case 'multi': return {
				style: CodegenEncodingStyle.FORM,
				explode: true,
				allowReserved: false,
				allowEmptyValue: false,
			}
			default: /* OpenAPI v3 doesn't support "tsv" style */
				throw new Error(`Collection format ${parameter.collectionFormat} is not supported in ${source} "${name}`)
		}
	} else {
		const style = (parameter.style as CodegenEncodingStyle | undefined) || defaultEncodingStyle(parameterIn)

		return {
			style,
			explode: convertToBoolean(parameter.explode, style === CodegenEncodingStyle.FORM),
			allowReserved: convertToBoolean(parameter.allowReserved, false),
			allowEmptyValue: convertToBoolean(parameter.allowEmptyValue, false),
		}
	}
}

function defaultEncodingStyle(parameterIn: string): CodegenEncodingStyle {
	switch (parameterIn) {
		case 'query': return CodegenEncodingStyle.FORM
		case 'path': return CodegenEncodingStyle.SIMPLE
		case 'header': return CodegenEncodingStyle.SIMPLE
		case 'cookie': return CodegenEncodingStyle.FORM
		case 'formData': return CodegenEncodingStyle.FORM
	}
	throw new Error(`Unsupported 'in' for parameter: ${parameterIn}`)
}
