import { CodegenObjectLikeSchemas, CodegenProperties } from '@openapi-generator-plus/types'
import * as idx from '@openapi-generator-plus/indexed-type'

/**
 * Return all of the unique properties, including inherited properties, for a model, where properties
 * in submodels override any same-named properties in parent models.
 * @param schema 
 * @param result 
 */
export function uniquePropertiesIncludingInherited(schema: CodegenObjectLikeSchemas, result: CodegenProperties = idx.create()): CodegenProperties {
	if (schema.parents) {
		for (const aParent of schema.parents) {
			uniquePropertiesIncludingInherited(aParent, result)
		}
	}
	if (schema.properties) {
		idx.merge(result, schema.properties)
	}

	return result
}

/**
 * Return an object containing all of the unique properties, including inherited properties, for an array of parent schemas, where properties
 * in child schemas override any same-named properties in parent schemas.
 * @param schemas 
 * @param result 
 */
export function uniquePropertiesIncludingInheritedForParents(schemas: CodegenObjectLikeSchemas[]): CodegenProperties {
	const schemaProperties = schemas.map(schema => uniquePropertiesIncludingInherited(schema))

	const result: CodegenProperties = idx.create()
	for (const properties of schemaProperties) {
		idx.merge(result, properties)
	}

	return result
}
