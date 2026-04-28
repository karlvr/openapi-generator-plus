import type { OpenAPIV2, OpenAPIV3 } from 'openapi-types'
import { filterOpenAPISpec } from '../filter'

function v3Doc(): OpenAPIV3.Document {
	return {
		openapi: '3.0.0',
		info: { title: 'test', version: '1.0' },
		tags: [
			{ name: 'pets' },
			{ name: 'admin' },
			{ name: 'store' },
		],
		paths: {
			'/pets': {
				get: {
					tags: ['pets'],
					responses: { '200': { $ref: '#/components/responses/PetList' } },
				},
				post: {
					tags: ['pets', 'admin'],
					requestBody: { $ref: '#/components/requestBodies/NewPet' },
					responses: { '200': { description: 'ok' } },
				},
			},
			'/pets/{id}': {
				get: {
					tags: ['pets'],
					parameters: [{ $ref: '#/components/parameters/IdParam' }],
					responses: {
						'200': {
							description: 'ok',
							content: { 'application/json': { schema: { $ref: '#/components/schemas/Pet' } } },
						},
					},
				},
			},
			'/admin/users': {
				get: {
					tags: ['admin'],
					responses: {
						'200': {
							description: 'ok',
							content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } },
						},
					},
				},
			},
			'/store/orders': {
				get: {
					tags: ['store'],
					responses: { '200': { description: 'ok' } },
				},
			},
		},
		components: {
			schemas: {
				Pet: {
					type: 'object',
					properties: {
						owner: { $ref: '#/components/schemas/Owner' },
					},
				},
				Owner: { type: 'object', properties: { name: { type: 'string' } } },
				User: { type: 'object' },
				Unused: { type: 'object' },
			},
			responses: {
				PetList: {
					description: 'list',
					content: { 'application/json': { schema: { $ref: '#/components/schemas/Pet' } } },
				},
				UnusedResponse: { description: 'nope' },
			},
			requestBodies: {
				NewPet: {
					content: { 'application/json': { schema: { $ref: '#/components/schemas/Pet' } } },
				},
			},
			parameters: {
				IdParam: { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
				UnusedParam: { name: 'q', in: 'query', schema: { type: 'string' } },
			},
			securitySchemes: {
				api_key: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
				unused_auth: { type: 'apiKey', in: 'header', name: 'X-Other' },
			},
		},
		security: [{ api_key: [] }],
	}
}

test('returns input unchanged when no filters', () => {
	const doc = v3Doc()
	const filtered = filterOpenAPISpec(doc, {})
	expect(filtered).toBe(doc)
})

test('include-tag keeps only operations with matching tag', () => {
	const filtered = filterOpenAPISpec(v3Doc(), { includeTags: ['pets'] })
	expect(Object.keys(filtered.paths)).toEqual(['/pets', '/pets/{id}'])
	expect(filtered.paths['/pets']?.get).toBeDefined()
	expect(filtered.paths['/pets']?.post).toBeDefined()
	expect(filtered.paths['/pets/{id}']?.get).toBeDefined()
})

test('exclude-tag drops operations with matching tag', () => {
	const filtered = filterOpenAPISpec(v3Doc(), { excludeTags: ['admin'] })
	expect(filtered.paths['/admin/users']).toBeUndefined()
	expect(filtered.paths['/pets']?.post).toBeUndefined()
	expect(filtered.paths['/pets']?.get).toBeDefined()
})

test('exclude-tag applies after include-tag', () => {
	const filtered = filterOpenAPISpec(v3Doc(), { includeTags: ['pets'], excludeTags: ['admin'] })
	expect(filtered.paths['/pets']?.post).toBeUndefined()
	expect(filtered.paths['/pets']?.get).toBeDefined()
})

test('include-tag drops operations without any tags', () => {
	const doc = v3Doc()
	doc.paths['/untagged'] = { get: { responses: { '200': { description: 'ok' } } } }
	const filtered = filterOpenAPISpec(doc, { includeTags: ['pets'] })
	expect(filtered.paths['/untagged']).toBeUndefined()
})

test('include-path globs match OpenAPI paths', () => {
	const filtered = filterOpenAPISpec(v3Doc(), { includePaths: ['/pets/**', '/pets'] })
	expect(Object.keys(filtered.paths)).toEqual(['/pets', '/pets/{id}'])
})

test('exclude-path globs drop matching paths', () => {
	const filtered = filterOpenAPISpec(v3Doc(), { excludePaths: ['/admin/**'] })
	expect(filtered.paths['/admin/users']).toBeUndefined()
	expect(filtered.paths['/pets']).toBeDefined()
})

test('prunes unreferenced components', () => {
	const filtered = filterOpenAPISpec(v3Doc(), { includeTags: ['pets'] })
	const components = filtered.components!
	expect(components.schemas).toBeDefined()
	expect(Object.keys(components.schemas!).sort()).toEqual(['Owner', 'Pet'])
	expect(components.responses).toBeDefined()
	expect(Object.keys(components.responses!)).toEqual(['PetList'])
	expect(components.requestBodies).toBeDefined()
	expect(Object.keys(components.requestBodies!)).toEqual(['NewPet'])
	expect(components.parameters).toBeDefined()
	expect(Object.keys(components.parameters!)).toEqual(['IdParam'])
	expect(components.securitySchemes).toBeDefined()
	expect(Object.keys(components.securitySchemes!)).toEqual(['api_key'])
})

test('prunes unused root tags', () => {
	const filtered = filterOpenAPISpec(v3Doc(), { includeTags: ['pets'], excludeTags: ['admin'] })
	expect(filtered.tags?.map(t => t.name)).toEqual(['pets'])
})

test('keeps root tag when a kept operation still references it via another tag', () => {
	const filtered = filterOpenAPISpec(v3Doc(), { includeTags: ['pets'] })
	expect(filtered.tags?.map(t => t.name).sort()).toEqual(['admin', 'pets'])
})

test('mutates input document and returns it', () => {
	const doc = v3Doc()
	const result = filterOpenAPISpec(doc, { includeTags: ['pets'] })
	expect(result).toBe(doc)
	expect(doc.paths['/admin/users']).toBeUndefined()
})

test('transitive schema refs are kept', () => {
	const filtered = filterOpenAPISpec(v3Doc(), { includeTags: ['pets'] })
	expect(filtered.components?.schemas?.Owner).toBeDefined()
})

function v2Doc(): OpenAPIV2.Document {
	return {
		swagger: '2.0',
		info: { title: 't', version: '1' },
		paths: {
			'/pets': {
				get: {
					tags: ['pets'],
					responses: { '200': { $ref: '#/responses/PetList' } },
				},
			},
			'/admin': {
				get: {
					tags: ['admin'],
					responses: { '200': { description: 'ok' } },
				},
			},
		},
		definitions: {
			Pet: {
				type: 'object',
				properties: { owner: { $ref: '#/definitions/Owner' } },
			},
			Owner: { type: 'object' },
			Unused: { type: 'object' },
		},
		responses: {
			PetList: { description: 'list', schema: { $ref: '#/definitions/Pet' } },
			UnusedResponse: { description: 'nope' },
		},
		parameters: {
			Unused: { name: 'q', in: 'query', type: 'string' },
		},
		securityDefinitions: {
			api_key: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
			unused_auth: { type: 'basic' },
		},
		security: [{ api_key: [] }],
	}
}

test('v2: filters operations and prunes definitions', () => {
	const filtered = filterOpenAPISpec(v2Doc(), { includeTags: ['pets'] })
	expect(filtered.paths['/admin']).toBeUndefined()
	expect(Object.keys(filtered.definitions!).sort()).toEqual(['Owner', 'Pet'])
	expect(Object.keys(filtered.responses!)).toEqual(['PetList'])
	expect(filtered.parameters).toBeUndefined()
	expect(Object.keys(filtered.securityDefinitions!)).toEqual(['api_key'])
})
