import type { OpenAPIV3 } from 'openapi-types'
import { activatePatchesInOpenAPISpec } from '../activate-patches'

function baseDoc(): OpenAPIV3.Document {
	return {
		openapi: '3.0.0',
		info: { title: 'test', version: '1.0' },
		paths: {
			'/pets': {
				get: {
					summary: 'Default summary',
					'x-server-summary': 'Server summary',
					responses: { '200': { description: 'ok' } },
				} as OpenAPIV3.OperationObject,
			},
		},
	}
}

test('promotes x-{name}- key over an existing key', () => {
	const result = activatePatchesInOpenAPISpec(baseDoc(), ['server'])
	const op = result.paths!['/pets']!.get!
	expect(op.summary).toBe('Server summary')
	expect((op as Record<string, unknown>)['x-server-summary']).toBeUndefined()
})

test('adds new key when no existing key is present', () => {
	const doc: OpenAPIV3.Document = {
		openapi: '3.0.0',
		info: { title: 'test', version: '1.0' },
		paths: {
			'/pets': {
				get: {
					'x-server-description': 'Server description',
					responses: { '200': { description: 'ok' } },
				} as OpenAPIV3.OperationObject,
			},
		},
	}
	const result = activatePatchesInOpenAPISpec(doc, ['server'])
	const op = result.paths!['/pets']!.get! as Record<string, unknown>
	expect(op.description).toBe('Server description')
	expect(op['x-server-description']).toBeUndefined()
})

test('walks into nested objects, arrays, components/schemas', () => {
	const doc: OpenAPIV3.Document = {
		openapi: '3.0.0',
		info: { title: 'test', version: '1.0' },
		paths: {
			'/pets': {
				get: {
					tags: ['pets'],
					parameters: [
						{
							name: 'id',
							in: 'query',
							description: 'default',
							'x-server-description': 'server-side',
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
					description: 'default',
					'x-server-description': 'inside components',
				} as unknown as OpenAPIV3.SchemaObject,
			},
		},
	}
	const result = activatePatchesInOpenAPISpec(doc, ['server'])
	const param = result.paths!['/pets']!.get!.parameters![0] as unknown as Record<string, unknown>
	expect(param.description).toBe('server-side')
	expect(param['x-server-description']).toBeUndefined()
	const pet = result.components!.schemas!.Pet as Record<string, unknown>
	expect(pet.description).toBe('inside components')
	expect(pet['x-server-description']).toBeUndefined()
})

test('no-op when names is empty', () => {
	const doc = baseDoc()
	const result = activatePatchesInOpenAPISpec(doc, [])
	expect(result).toBe(doc)
})

test('mutates the input document and returns it', () => {
	const doc = baseDoc()
	const result = activatePatchesInOpenAPISpec(doc, ['server'])
	expect(result).toBe(doc)
	const op = doc.paths!['/pets']!.get! as Record<string, unknown>
	expect(op.summary).toBe('Server summary')
	expect(op['x-server-summary']).toBeUndefined()
})

test('applies activations sequentially in order', () => {
	const doc: OpenAPIV3.Document = {
		openapi: '3.0.0',
		info: { title: 'test', version: '1.0' },
		paths: {
			'/pets': {
				get: {
					'x-server-x-other-foo': 'value',
					responses: { '200': { description: 'ok' } },
				} as OpenAPIV3.OperationObject,
			},
		},
	}
	const result = activatePatchesInOpenAPISpec(doc, ['server', 'other'])
	const op = result.paths!['/pets']!.get! as Record<string, unknown>
	expect(op.foo).toBe('value')
	expect(op['x-server-x-other-foo']).toBeUndefined()
	expect(op['x-other-foo']).toBeUndefined()
})

test('recurses into the promoted value', () => {
	const doc: OpenAPIV3.Document = {
		openapi: '3.0.0',
		info: { title: 'test', version: '1.0' },
		paths: {
			'/pets': {
				get: {
					'x-server-foo': { 'x-server-bar': 1 },
					responses: { '200': { description: 'ok' } },
				} as unknown as OpenAPIV3.OperationObject,
			},
		},
	}
	const result = activatePatchesInOpenAPISpec(doc, ['server'])
	const op = result.paths!['/pets']!.get! as Record<string, unknown>
	expect(op.foo).toEqual({ bar: 1 })
})

test('rewrites a property nested deep inside a component schema', () => {
	const doc: OpenAPIV3.Document = {
		openapi: '3.0.0',
		info: { title: 'test', version: '1.0' },
		paths: {},
		components: {
			schemas: {
				Pet: {
					type: 'object',
					properties: {
						bar: {
							type: 'integer',
							'x-server-type': 'string',
						} as unknown as OpenAPIV3.SchemaObject,
					},
				},
			},
		},
	}
	activatePatchesInOpenAPISpec(doc, ['server'])
	const bar = (doc.components!.schemas!.Pet as OpenAPIV3.SchemaObject).properties!.bar as Record<string, unknown>
	expect(bar.type).toBe('string')
	expect(bar['x-server-type']).toBeUndefined()
})

test('does not rewrite a bare x-{name} key without trailing dash', () => {
	const doc: OpenAPIV3.Document = {
		openapi: '3.0.0',
		info: { title: 'test', version: '1.0' },
		paths: {
			'/pets': {
				get: {
					'x-server': 'kept',
					responses: { '200': { description: 'ok' } },
				} as unknown as OpenAPIV3.OperationObject,
			},
		},
	}
	const result = activatePatchesInOpenAPISpec(doc, ['server'])
	const op = result.paths!['/pets']!.get! as Record<string, unknown>
	expect(op['x-server']).toBe('kept')
})
