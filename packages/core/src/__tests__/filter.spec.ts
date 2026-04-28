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

function v3DocWithXTags(): OpenAPIV3.Document {
	return {
		openapi: '3.0.0',
		info: { title: 'test', version: '1.0' },
		paths: {
			'/widgets': {
				get: {
					tags: ['widgets'],
					parameters: [
						{ name: 'q', in: 'query', schema: { type: 'string' } },
						{ name: 'debug', in: 'query', schema: { type: 'boolean' }, 'x-tags': ['internal'] } as OpenAPIV3.ParameterObject,
					],
					responses: {
						'200': {
							description: 'ok',
							content: {
								'application/json': { schema: { $ref: '#/components/schemas/Widget' } },
								'application/x-internal+json': {
									schema: { $ref: '#/components/schemas/Widget' },
									'x-tags': ['internal'],
								} as OpenAPIV3.MediaTypeObject,
							},
						},
						'500': {
							description: 'oops',
							'x-tags': ['internal'],
						} as OpenAPIV3.ResponseObject,
					},
					requestBody: {
						content: { 'application/json': { schema: { $ref: '#/components/schemas/Widget' } } },
						'x-tags': ['internal'],
					} as OpenAPIV3.RequestBodyObject,
				},
			},
		},
		components: {
			schemas: {
				Widget: {
					type: 'object',
					required: ['id', 'secret'],
					properties: {
						id: { type: 'string' },
						name: { type: 'string' },
						secret: { type: 'string', 'x-tags': ['internal'] } as OpenAPIV3.SchemaObject,
					},
				},
			},
		},
	}
}

test('x-tags: drops properties tagged for exclusion and removes them from required', () => {
	const filtered = filterOpenAPISpec(v3DocWithXTags(), { excludeTags: ['internal'] })
	const widget = filtered.components!.schemas!.Widget as OpenAPIV3.SchemaObject
	expect(Object.keys(widget.properties!)).toEqual(['id', 'name'])
	expect(widget.required).toEqual(['id'])
})

test('x-tags: drops parameters tagged for exclusion', () => {
	const filtered = filterOpenAPISpec(v3DocWithXTags(), { excludeTags: ['internal'] })
	const op = filtered.paths['/widgets']!.get!
	expect(op.parameters?.map(p => (p as OpenAPIV3.ParameterObject).name)).toEqual(['q'])
})

test('x-tags: drops media-type variants tagged for exclusion', () => {
	const filtered = filterOpenAPISpec(v3DocWithXTags(), { excludeTags: ['internal'] })
	const op = filtered.paths['/widgets']!.get!
	const ok = op.responses!['200'] as OpenAPIV3.ResponseObject
	expect(Object.keys(ok.content!)).toEqual(['application/json'])
})

test('x-tags: drops response codes tagged for exclusion', () => {
	const filtered = filterOpenAPISpec(v3DocWithXTags(), { excludeTags: ['internal'] })
	const op = filtered.paths['/widgets']!.get!
	expect(Object.keys(op.responses!)).toEqual(['200'])
})

test('x-tags: drops requestBody tagged for exclusion', () => {
	const filtered = filterOpenAPISpec(v3DocWithXTags(), { excludeTags: ['internal'] })
	const op = filtered.paths['/widgets']!.get!
	expect(op.requestBody).toBeUndefined()
})

test('x-tags: untagged sub-positions are kept; x-tagged positions filter on x-tags only', () => {
	const doc = v3DocWithXTags()
	// Operation is tagged 'widgets'; an include filter for 'widgets' keeps the operation
	// and its untagged sub-positions. Sub-positions x-tagged 'internal' fail the include
	// filter (their x-tags alone don't match 'widgets') and also hit the exclude filter.
	const filtered = filterOpenAPISpec(doc, { includeTags: ['widgets'], excludeTags: ['internal'] })
	const op = filtered.paths['/widgets']!.get!
	expect(op.parameters?.map(p => (p as OpenAPIV3.ParameterObject).name)).toEqual(['q'])
	const widget = filtered.components!.schemas!.Widget as OpenAPIV3.SchemaObject
	expect(Object.keys(widget.properties!)).toEqual(['id', 'name'])
})

test('x-tags: include-only filter on a sub-position tag keeps that position', () => {
	// An include filter for 'internal' alone won't keep the operation (op tagged only 'widgets'),
	// so the whole operation goes away. Verify that.
	const filtered = filterOpenAPISpec(v3DocWithXTags(), { includeTags: ['internal'] })
	expect(filtered.paths['/widgets']).toBeUndefined()
})

test('x-tags: only path filters set — sub-position x-tags are not applied', () => {
	const filtered = filterOpenAPISpec(v3DocWithXTags(), { includePaths: ['/widgets'] })
	const widget = filtered.components!.schemas!.Widget as OpenAPIV3.SchemaObject
	// secret should still be present since no tag filter is active
	expect(Object.keys(widget.properties!).sort()).toEqual(['id', 'name', 'secret'])
})

test('x-tags: empty schema after dropping all properties remains valid', () => {
	const doc: OpenAPIV3.Document = {
		openapi: '3.0.0',
		info: { title: 't', version: '1' },
		paths: {
			'/things': {
				get: {
					tags: ['things'],
					responses: {
						'200': {
							description: 'ok',
							content: { 'application/json': { schema: { $ref: '#/components/schemas/Thing' } } },
						},
					},
				},
			},
		},
		components: {
			schemas: {
				Thing: {
					type: 'object',
					required: ['only'],
					properties: {
						only: { type: 'string', 'x-tags': ['internal'] } as OpenAPIV3.SchemaObject,
					},
				},
			},
		},
	}
	const filtered = filterOpenAPISpec(doc, { excludeTags: ['internal'] })
	const thing = filtered.components!.schemas!.Thing as OpenAPIV3.SchemaObject
	expect(thing.properties).toEqual({})
	expect(thing.required).toBeUndefined()
})

test('x-tags: applies inside nested schemas (items, allOf)', () => {
	const doc: OpenAPIV3.Document = {
		openapi: '3.0.0',
		info: { title: 't', version: '1' },
		paths: {
			'/x': {
				get: {
					tags: ['x'],
					responses: {
						'200': {
							description: 'ok',
							content: { 'application/json': { schema: { $ref: '#/components/schemas/Box' } } },
						},
					},
				},
			},
		},
		components: {
			schemas: {
				Box: {
					allOf: [
						{
							type: 'object',
							properties: {
								keep: { type: 'string' },
								drop: { type: 'string', 'x-tags': ['internal'] } as OpenAPIV3.SchemaObject,
							},
						},
					],
					type: 'object',
					properties: {
						items: {
							type: 'array',
							items: {
								type: 'object',
								properties: {
									keep2: { type: 'string' },
									drop2: { type: 'string', 'x-tags': ['internal'] } as OpenAPIV3.SchemaObject,
								},
							},
						},
					},
				},
			},
		},
	}
	const filtered = filterOpenAPISpec(doc, { excludeTags: ['internal'] })
	const box = filtered.components!.schemas!.Box as OpenAPIV3.SchemaObject
	const allOfFirst = box.allOf![0] as OpenAPIV3.SchemaObject
	expect(Object.keys(allOfFirst.properties!)).toEqual(['keep'])
	const itemsSchema = (box.properties!.items as OpenAPIV3.ArraySchemaObject).items as OpenAPIV3.SchemaObject
	expect(Object.keys(itemsSchema.properties!)).toEqual(['keep2'])
})

test('x-tags: v2 properties and parameters', () => {
	const doc: OpenAPIV2.Document = {
		swagger: '2.0',
		info: { title: 't', version: '1' },
		paths: {
			'/things': {
				get: {
					tags: ['things'],
					parameters: [
						{ name: 'q', in: 'query', type: 'string' },
						{ name: 'debug', in: 'query', type: 'boolean', 'x-tags': ['internal'] } as OpenAPIV2.Parameter,
					],
					responses: { '200': { description: 'ok', schema: { $ref: '#/definitions/Thing' } } },
				},
			},
		},
		definitions: {
			Thing: {
				type: 'object',
				required: ['id', 'secret'],
				properties: {
					id: { type: 'string' },
					secret: { type: 'string', 'x-tags': ['internal'] } as OpenAPIV2.Schema,
				},
			},
		},
	}
	const filtered = filterOpenAPISpec(doc, { excludeTags: ['internal'] })
	const thing = filtered.definitions!.Thing as OpenAPIV2.SchemaObject
	expect(Object.keys(thing.properties!)).toEqual(['id'])
	expect(thing.required).toEqual(['id'])
	const op = filtered.paths['/things']!.get!
	expect(op.parameters?.map(p => (p as OpenAPIV2.Parameter).name)).toEqual(['q'])
})

test('x-tags: input is mutated in place', () => {
	const doc = v3DocWithXTags()
	const result = filterOpenAPISpec(doc, { excludeTags: ['internal'] })
	expect(result).toBe(doc)
	const widget = doc.components!.schemas!.Widget as OpenAPIV3.SchemaObject
	expect(Object.keys(widget.properties!)).toEqual(['id', 'name'])
})

test('x-tags: accepts a single string in place of an array', () => {
	const doc: OpenAPIV3.Document = {
		openapi: '3.0.0',
		info: { title: 't', version: '1' },
		paths: {
			'/widgets': {
				get: {
					tags: ['widgets'],
					responses: {
						'200': {
							description: 'ok',
							content: {
								'application/json': { schema: { $ref: '#/components/schemas/Widget' } },
							},
						},
					},
				} as OpenAPIV3.OperationObject,
			},
		},
		components: {
			schemas: {
				Widget: {
					type: 'object',
					properties: {
						id: { type: 'string' },
						secret: { type: 'string', 'x-tags': 'internal' } as unknown as OpenAPIV3.SchemaObject,
					},
				},
			},
		},
	}
	const filtered = filterOpenAPISpec(doc, { excludeTags: ['internal'] })
	const widget = filtered.components!.schemas!.Widget as OpenAPIV3.SchemaObject
	expect(Object.keys(widget.properties!)).toEqual(['id'])
})
