import { CodegenHierarchySchema, CodegenSchemaPurpose, CodegenSchemaType } from '@openapi-generator-plus/types'
import { isOpenAPIv3SchemaObject } from '../../openapi-type-guards'
import { InternalCodegenState } from '../../types'
import { OpenAPIX } from '../../types/patches'
import { toCodegenVendorExtensions } from '../vendor-extensions'
import { extractNaming, ScopedModelInfo } from './naming'
import { addToKnownSchemas, extractCodegenSchemaCommon, finaliseSchema } from './utils'
import { toCodegenExamples } from '../examples'
import { discoverDiscriminatorReferencesInOtherDocuments, loadDiscriminatorMappings, toCodegenSchemaDiscriminator } from './discriminator'
import { toCodegenProperties } from './property'
import { toCodegenExternalDocs } from '../external-docs'
import { createIfNotExistsCodegenInterfaceSchema } from './interface'

export function toCodegenHierarchySchema(apiSchema: OpenAPIX.SchemaObject, naming: ScopedModelInfo, purpose: CodegenSchemaPurpose, state: InternalCodegenState): CodegenHierarchySchema {
	const { scopedName, scope } = naming

	const vendorExtensions = toCodegenVendorExtensions(apiSchema)

	const nativeType = state.generator.toNativeObjectType({
		type: 'object',
		purpose,
		schemaType: CodegenSchemaType.HIERARCHY,
		scopedName,
		vendorExtensions,
	})

	let result: CodegenHierarchySchema = {
		...extractNaming(naming),
		...extractCodegenSchemaCommon(apiSchema, state),

		discriminator: null,
		discriminatorValues: null,
		polymorphic: true,
		vendorExtensions,
		externalDocs: toCodegenExternalDocs(apiSchema),
		nativeType,
		type: 'hierarchy',
		format: null,
		purpose,
		schemaType: CodegenSchemaType.HIERARCHY,
		contentMediaType: null,
		component: null,
		deprecated: false,
		examples: null,
		schemas: null,

		properties: null,
		additionalProperties: null,
		parents: null,
		interface: null,

		composes: [],
		implements: null,
	}

	result.examples = toCodegenExamples(apiSchema.example, undefined, undefined, result, state)

	if (isOpenAPIv3SchemaObject(apiSchema, state.specVersion)) {
		result.deprecated = apiSchema.deprecated || false
	}

	/* Must add model to knownSchemas here before we try to load other models to avoid infinite loop
	   when a model references other models that in turn reference this model.
	 */
	result = addToKnownSchemas(apiSchema, result, naming.$ref, state)

	result.properties = toCodegenProperties(apiSchema, result, state) || null

	result.interface = createIfNotExistsCodegenInterfaceSchema(result, scope, CodegenSchemaPurpose.INTERFACE, state)

	/* Process discriminator after adding composes so they can be used */
	result.discriminator = toCodegenSchemaDiscriminator(apiSchema, result, state)
	loadDiscriminatorMappings(result, state)
	discoverDiscriminatorReferencesInOtherDocuments(apiSchema, state)
	finaliseSchema(result, naming, state)
	return result
}
