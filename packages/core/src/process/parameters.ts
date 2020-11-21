import { CodegenExamples, CodegenParameter, CodegenParameterIn, CodegenParameters, CodegenSchema, CodegenSchemaPurpose } from '@openapi-generator-plus/types'
import { OpenAPI } from 'openapi-types'
import { isOpenAPIV2GeneralParameterObject } from '../openapi-type-guards'
import { InternalCodegenState } from '../types'
import { toCodegenExamples } from './examples'
import { extractCodegenSchemaInfo, resolveReference } from './utils'
import { toCodegenVendorExtensions } from './vendor-extensions'
import * as idx from '@openapi-generator-plus/indexed-type'
import { OpenAPIX } from '../types/patches'
import { toCodegenSchema } from './schema'

export function toCodegenParameters(parameters: OpenAPIX.Parameters, pathParameters: CodegenParameters | undefined, scopeName: string, state: InternalCodegenState): CodegenParameters | undefined {
	const result: CodegenParameters = idx.create()
	if (pathParameters) {
		idx.merge(result, pathParameters)
	}
	for (const parameter of parameters) {
		const codegenParameter = toCodegenParameter(parameter, scopeName, state)
		idx.set(result, codegenParameter.name, codegenParameter)
	}
	return idx.undefinedIfEmpty(result)
}

function toCodegenParameter(parameter: OpenAPI.Parameter, scopeName: string, state: InternalCodegenState): CodegenParameter {
	parameter = resolveReference(parameter, state)

	let schema: CodegenSchema | undefined
	let examples: CodegenExamples | undefined
	if (parameter.schema) {
		/* We pass [] as scopeNames so we create any nested models at the root of the models package,
		 * as we reference all models relative to the models package, but a parameter is in an
		 * operation. TODO it would be nice to improve this; maybe we can declare an enum in an Api
		 * interface... we'd just need to make sure that the nativeTypes referring to it were fixed.
		 * But we don't know the Api class name at this point. If we knew it, we could perhaps pass
		 * the package along with the scope names in all cases. 
		 * However it's sort of up to the templates to decide where to output models... so does that
		 * mean that we need to provide more info to toNativeType so it can put in full package names?
		 */
		schema = toCodegenSchema(parameter.schema, parameter.required || false, `${scopeName}_${parameter.name}`, CodegenSchemaPurpose.PARAMETER, null, state)

		examples = toCodegenExamples(parameter.example, parameter.examples, undefined, schema, state)
	} else if (isOpenAPIV2GeneralParameterObject(parameter, state.specVersion)) {
		schema = toCodegenSchema(parameter, parameter.required || false, `${scopeName}_${parameter.name}`, CodegenSchemaPurpose.PARAMETER, null, state)
	} else {
		throw new Error(`Cannot resolve schema for parameter: ${JSON.stringify(parameter)}`)
	}

	const result: CodegenParameter = {
		name: parameter.name,

		...extractCodegenSchemaInfo(schema),

		in: parameter.in as CodegenParameterIn,
		description: parameter.description,
		required: parameter.required || false,
		collectionFormat: isOpenAPIV2GeneralParameterObject(parameter, state.specVersion) ? parameter.collectionFormat : undefined, // TODO OpenAPI3
		examples,

		schema,

		vendorExtensions: toCodegenVendorExtensions(parameter),
	}
	switch (parameter.in) {
		case 'query':
			result.isQueryParam = true
			break
		case 'path':
			result.isPathParam = true
			result.required = true
			break
		case 'header':
			result.isHeaderParam = true
			break
		case 'cookie':
			result.isCookieParam = true
			break
		case 'body':
			/* The body parameter will be extracted by the caller */
			break
		case 'formData':
			result.isFormParam = true
			break
		default:
			throw new Error(`Unsupported parameter "in" value: ${parameter.in}`)
	}

	return result
}
