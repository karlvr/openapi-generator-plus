import { CodegenAnyOfStrategy, CodegenDocument, CodegenInterfaceSchema, CodegenNamedSchemas, CodegenNativeType, CodegenOneOfStrategy, CodegenParameters, CodegenProperties, CodegenSchema, CodegenSchemaUsage, CodegenWrapperSchema, isCodegenWrapperSchema } from '@openapi-generator-plus/types'
import { idx } from '../'
import { createTestDocument } from './common'
import { TestCodegenConfig } from '@openapi-generator-plus/test-generator'

/* A schema usage's native type is derived from the usage, so any change to the usage must be
   followed by re-deriving it. Where that doesn't happen a generator that expresses `required` or
   `nullable` in the type — Swift's optionals, Java's primitives — declares something it doesn't
   mean, and the mistake is invisible to a generator that expresses them some other way.

   These tests use a transformer that puts the usage into the native type, so that any usage the
   core leaves behind shows up as a mismatch.
 */

function describeUsage(nativeType: string, required: boolean, nullable: boolean): string {
	return `${required ? 'required' : 'optional'}${nullable ? ' nullable' : ''} ${nativeType}`
}

const CONFIG: TestCodegenConfig = {
	nativeTypeUsageTransformer: ({ required, nullable }) => ({
		default: (nativeType: CodegenNativeType) => describeUsage(nativeType.nativeType, required, nullable),
	}),
}

/** What the usage's native type should be, given the usage it ended up with. */
function expectedNativeType(usage: CodegenSchemaUsage): string {
	return describeUsage(String(usage.schema.nativeType), usage.required, usage.nullable)
}

/** The parts of the schema types we walk, without needing a type guard for each one. */
interface SchemaLike {
	properties?: CodegenProperties | null
	schemas?: CodegenNamedSchemas | null
	composes?: CodegenSchema[] | null
	implements?: CodegenSchema[] | null
	parents?: CodegenSchema[] | null
	component?: CodegenSchemaUsage | null
}

interface FoundUsage {
	path: string
	usage: CodegenSchemaUsage
}

/** Every property and parameter in the document, with a path to report when one doesn't match. */
function findUsages(doc: CodegenDocument): FoundUsage[] {
	const result: FoundUsage[] = []
	const seen = new Set<CodegenSchema>()

	function visitUsage(usage: CodegenSchemaUsage, path: string) {
		result.push({ path, usage })
		visitSchema(usage.schema, path)
	}

	function visitSchema(schema: CodegenSchema, path: string) {
		if (seen.has(schema)) {
			return
		}
		seen.add(schema)

		const schemaLike = schema as SchemaLike

		if (schemaLike.properties) {
			for (const property of idx.allValues(schemaLike.properties)) {
				visitUsage(property, `${path}.${property.name}`)
			}
		}
		if (isCodegenWrapperSchema(schema)) {
			visitUsage((schema as CodegenWrapperSchema).property, `${path}.value`)
		}
		if (schemaLike.component) {
			visitUsage(schemaLike.component, `${path}[]`)
		}
		if (schemaLike.schemas) {
			for (const nested of idx.allValues(schemaLike.schemas)) {
				visitSchema(nested, nested.name || path)
			}
		}
		for (const related of [...(schemaLike.composes || []), ...(schemaLike.implements || []), ...(schemaLike.parents || [])]) {
			visitSchema(related, related.name || path)
		}
	}

	for (const schema of idx.allValues(doc.schemas)) {
		visitSchema(schema, schema.name || 'anonymous')
	}

	for (const group of doc.groups) {
		for (const operation of group.operations) {
			const parameterSets: (CodegenParameters | null)[] = [
				operation.parameters, operation.queryParams, operation.pathParams, operation.headerParams, operation.cookieParams,
			]
			for (const parameters of parameterSets) {
				if (!parameters) {
					continue
				}
				for (const parameter of idx.allValues(parameters)) {
					visitUsage(parameter, `${operation.name}(${parameter.name})`)
				}
			}
		}
	}

	return result
}

function expectUsagesMatchNativeTypes(doc: CodegenDocument) {
	const usages = findUsages(doc)
	expect(usages.length).toBeGreaterThan(0)

	const mismatched = usages
		.filter(({ usage }) => String(usage.nativeType) !== expectedNativeType(usage))
		.map(({ path, usage }) => `${path}: declared "${usage.nativeType}", usage is "${expectedNativeType(usage)}"`)
	expect(mismatched).toEqual([])
}

/* Each case covers a place where the core adjusts a usage after creating it. */
const CASES: { spec: string; config: TestCodegenConfig }[] = [
	/* Absorbing an anyOf member makes its required properties optional */
	{ spec: 'any-of/any-of.yml', config: { anyOfStrategy: CodegenAnyOfStrategy.OBJECT } },
	{ spec: 'any-of/any-of.yml', config: { anyOfStrategy: CodegenAnyOfStrategy.NATIVE } },
	/* A oneOf of primitives wraps each member, and the wrapped value is always required */
	{ spec: 'one-of/one-of-primitives.yml', config: { oneOfStrategy: CodegenOneOfStrategy.INTERFACE } },
	{ spec: 'one-of/one-of-arrays.yml', config: { oneOfStrategy: CodegenOneOfStrategy.INTERFACE } },
	/* A $ref to a parameter may override whether it is required */
	{ spec: 'parameters/parameter-ref-required.yml', config: {} },
	/* Applying `required` from an allOf changes a property that has already been created */
	{ spec: 'all-of/all-of-simple.yml', config: {} },
	{ spec: 'all-of/all-of-multiple.yml', config: {} },
	{ spec: 'arrays/array-schema.yml', config: {} },
	{ spec: 'arrays/inline-items.yml', config: {} },
]

describe('native types match their usage', () => {
	for (const { spec, config } of CASES) {
		const name = Object.keys(config).length ? `${spec} (${Object.values(config).join(', ')})` : spec
		test(name, async() => {
			expectUsagesMatchNativeTypes(await createTestDocument(spec, { ...CONFIG, ...config }))
		})
	}
})

test('a wrapped oneOf member value is required', async() => {
	const result = await createTestDocument('one-of/one-of-primitives.yml', {
		...CONFIG,
		oneOfStrategy: CodegenOneOfStrategy.INTERFACE,
	})

	const oneOf = idx.get(result.schemas, 'OneOf') as CodegenInterfaceSchema
	expect(oneOf).toBeDefined()

	const nested: CodegenSchema[] = idx.allValues(oneOf.schemas!)
	const wrappers = nested.filter(isCodegenWrapperSchema)
	expect(wrappers.length).toBeGreaterThan(0)

	for (const wrapper of wrappers) {
		/* The wrapped value is always present, so it must be typed as required */
		expect(wrapper.property.required).toBe(true)
		expect(String(wrapper.property.nativeType)).toEqual(expectedNativeType(wrapper.property))
		expect(String(wrapper.property.nativeType)).toMatch(/^required /)
	}
})

test('a $ref that makes a parameter required types it as required', async() => {
	const result = await createTestDocument('parameters/parameter-ref-required.yml', CONFIG)

	const operation = result.groups[0].operations[0]
	const parameter = idx.allValues(operation.queryParams!)[0]

	expect(parameter.required).toBe(true)
	expect(parameter.deprecated).toBe(true)
	expect(String(parameter.nativeType)).toEqual(expectedNativeType(parameter))
	expect(String(parameter.nativeType)).toEqual('required string')
})
