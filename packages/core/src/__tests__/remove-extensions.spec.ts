import type { OpenAPIV3 } from 'openapi-types'
import { removeExtensionsFromOpenAPISpec } from '../remove-extensions'

function baseDoc(): OpenAPIV3.Document {
	return {
		openapi: '3.0.0',
		info: { title: 'test', version: '1.0' },
		paths: {
			'/pets': {
				get: {
					summary: 'List pets',
					'x-server-summary': 'Server summary',
					'x-server-description': 'Server description',
					'x-client-summary': 'Client summary',
					'x-internal': true,
					responses: { '200': { description: 'ok' } },
				} as OpenAPIV3.OperationObject,
			},
		},
	}
}

test('removes all keys matching the wildcard pattern', () => {
	const result = removeExtensionsFromOpenAPISpec(baseDoc(), ['server-*'])
	const op = result.paths!['/pets']!.get! as Record<string, unknown>
	expect(op.summary).toBe('List pets')
	expect(op['x-server-summary']).toBeUndefined()
	expect(op['x-server-description']).toBeUndefined()
	expect(op['x-client-summary']).toBe('Client summary')
	expect(op['x-internal']).toBe(true)
})

test('matches an exact extension name without a wildcard', () => {
	const result = removeExtensionsFromOpenAPISpec(baseDoc(), ['internal'])
	const op = result.paths!['/pets']!.get! as Record<string, unknown>
	expect(op['x-internal']).toBeUndefined()
	expect(op['x-server-summary']).toBe('Server summary')
})

test('accepts multiple patterns', () => {
	const result = removeExtensionsFromOpenAPISpec(baseDoc(), ['server-*', 'client-*'])
	const op = result.paths!['/pets']!.get! as Record<string, unknown>
	expect(op['x-server-summary']).toBeUndefined()
	expect(op['x-client-summary']).toBeUndefined()
	expect(op['x-internal']).toBe(true)
})

test('a bare * matches every vendor extension', () => {
	const result = removeExtensionsFromOpenAPISpec(baseDoc(), ['*'])
	const op = result.paths!['/pets']!.get! as Record<string, unknown>
	expect(op['x-server-summary']).toBeUndefined()
	expect(op['x-server-description']).toBeUndefined()
	expect(op['x-client-summary']).toBeUndefined()
	expect(op['x-internal']).toBeUndefined()
	expect(op.summary).toBe('List pets')
})

test('walks into nested objects, arrays, and components', () => {
	const doc: OpenAPIV3.Document = {
		openapi: '3.0.0',
		info: { title: 'test', version: '1.0' },
		paths: {
			'/pets': {
				get: {
					parameters: [
						{
							name: 'id',
							in: 'query',
							'x-server-validation': 'strict',
						} as unknown as OpenAPIV3.ParameterObject,
					],
					responses: { '200': { description: 'ok' } },
				},
			},
		},
		components: {
			schemas: {
				Pet: {
					type: 'object',
					'x-server-table': 'pets',
				} as unknown as OpenAPIV3.SchemaObject,
			},
		},
	}
	const result = removeExtensionsFromOpenAPISpec(doc, ['server-*'])
	const param = result.paths!['/pets']!.get!.parameters![0] as unknown as Record<string, unknown>
	expect(param['x-server-validation']).toBeUndefined()
	expect(param.name).toBe('id')
	const pet = result.components!.schemas!.Pet as Record<string, unknown>
	expect(pet['x-server-table']).toBeUndefined()
	expect(pet.type).toBe('object')
})

test('removes the entire subtree when the matching key holds an object', () => {
	const doc: OpenAPIV3.Document = {
		openapi: '3.0.0',
		info: { title: 'test', version: '1.0' },
		paths: {
			'/pets': {
				get: {
					'x-server-config': { 'x-keep-me': 'still-removed', nested: { 'x-server-deep': 1 } },
					responses: { '200': { description: 'ok' } },
				} as unknown as OpenAPIV3.OperationObject,
			},
		},
	}
	const result = removeExtensionsFromOpenAPISpec(doc, ['server-*'])
	const op = result.paths!['/pets']!.get! as Record<string, unknown>
	expect(op['x-server-config']).toBeUndefined()
})

test('does not match keys that lack the x- prefix', () => {
	const doc: OpenAPIV3.Document = {
		openapi: '3.0.0',
		info: { title: 'test', version: '1.0' },
		paths: {
			'/pets': {
				get: {
					summary: 'kept',
					responses: { '200': { description: 'ok' } },
				},
			},
		},
	}
	const result = removeExtensionsFromOpenAPISpec(doc, ['summary'])
	const op = result.paths!['/pets']!.get! as Record<string, unknown>
	expect(op.summary).toBe('kept')
})

test('escapes regex metacharacters in the pattern', () => {
	const doc: OpenAPIV3.Document = {
		openapi: '3.0.0',
		info: { title: 'test', version: '1.0' },
		paths: {
			'/pets': {
				get: {
					'x-foo.bar': 'gone',
					'x-fooXbar': 'kept',
					responses: { '200': { description: 'ok' } },
				} as unknown as OpenAPIV3.OperationObject,
			},
		},
	}
	const result = removeExtensionsFromOpenAPISpec(doc, ['foo.bar'])
	const op = result.paths!['/pets']!.get! as Record<string, unknown>
	expect(op['x-foo.bar']).toBeUndefined()
	expect(op['x-fooXbar']).toBe('kept')
})

test('no-op when patterns is empty', () => {
	const doc = baseDoc()
	const result = removeExtensionsFromOpenAPISpec(doc, [])
	expect(result).toBe(doc)
})

test('mutates the input document and returns it', () => {
	const doc = baseDoc()
	const result = removeExtensionsFromOpenAPISpec(doc, ['server-*'])
	expect(result).toBe(doc)
	const op = doc.paths!['/pets']!.get! as Record<string, unknown>
	expect(op['x-server-summary']).toBeUndefined()
	expect(op['x-server-description']).toBeUndefined()
})
