import type { OpenAPIV2, OpenAPIV3 } from 'openapi-types'
import { mergeOpenAPISpecs, MergeCollision } from '../merge'

function v3DocA(): OpenAPIV3.Document {
	return {
		openapi: '3.0.0',
		info: { title: 'a', version: '1.0' },
		tags: [{ name: 'pets' }],
		paths: {
			'/pets': {
				get: { tags: ['pets'], responses: { '200': { description: 'ok' } } },
			},
		},
		components: {
			schemas: {
				Pet: { type: 'object' },
				Shared: { type: 'object', properties: { from: { type: 'string', enum: ['a'] } } },
			},
		},
	}
}

function v3DocB(): OpenAPIV3.Document {
	return {
		openapi: '3.0.0',
		info: { title: 'b', version: '2.0' },
		tags: [{ name: 'admin' }, { name: 'pets', description: 'overridden' }],
		paths: {
			'/admin': {
				get: { tags: ['admin'], responses: { '200': { description: 'ok' } } },
			},
			'/pets': {
				post: { tags: ['admin'], responses: { '201': { description: 'created' } } },
			},
		},
		components: {
			schemas: {
				User: { type: 'object' },
				Shared: { type: 'object', properties: { from: { type: 'string', enum: ['b'] } } },
			},
		},
	}
}

test('returns input unchanged for a single document', () => {
	const doc = v3DocA()
	expect(mergeOpenAPISpecs([doc])).toBe(doc)
})

test('throws when given no documents', () => {
	expect(() => mergeOpenAPISpecs([])).toThrow()
})

test('merges paths and components from multiple v3 docs', () => {
	const merged = mergeOpenAPISpecs([v3DocA(), v3DocB()])
	expect(Object.keys(merged.paths).sort()).toEqual(['/admin', '/pets'])
	expect(Object.keys(merged.components!.schemas!).sort()).toEqual(['Pet', 'Shared', 'User'])
})

test('takes top-level metadata from the first document', () => {
	const merged = mergeOpenAPISpecs([v3DocA(), v3DocB()])
	expect(merged.info.title).toBe('a')
	expect(merged.info.version).toBe('1.0')
})

test('last-wins on path collisions and reports a collision', () => {
	const collisions: MergeCollision[] = []
	const merged = mergeOpenAPISpecs([v3DocA(), v3DocB()], {
		onCollision: c => collisions.push(c),
	})
	expect(merged.paths['/pets']).toEqual(v3DocB().paths['/pets'])
	expect(collisions).toContainEqual({ kind: 'paths', key: '/pets' })
})

test('last-wins on component schema collisions and reports a collision', () => {
	const collisions: MergeCollision[] = []
	const merged = mergeOpenAPISpecs([v3DocA(), v3DocB()], {
		onCollision: c => collisions.push(c),
	})
	const shared = merged.components!.schemas!.Shared as OpenAPIV3.SchemaObject
	expect((shared.properties!.from as OpenAPIV3.SchemaObject).enum).toEqual(['b'])
	expect(collisions).toContainEqual({ kind: 'components.schemas', key: 'Shared' })
})

test('unions tags by name and reports collisions on duplicates', () => {
	const collisions: MergeCollision[] = []
	const merged = mergeOpenAPISpecs([v3DocA(), v3DocB()], {
		onCollision: c => collisions.push(c),
	})
	expect(merged.tags!.map(t => t.name).sort()).toEqual(['admin', 'pets'])
	const pets = merged.tags!.find(t => t.name === 'pets')!
	expect(pets.description).toBe('overridden')
	expect(collisions).toContainEqual({ kind: 'tags', key: 'pets' })
})

test('does not mutate the input documents', () => {
	const a = v3DocA()
	const b = v3DocB()
	const aSnap = JSON.parse(JSON.stringify(a))
	const bSnap = JSON.parse(JSON.stringify(b))
	mergeOpenAPISpecs([a, b])
	expect(a).toEqual(aSnap)
	expect(b).toEqual(bSnap)
})

test('throws when mixing OpenAPI v2 and v3 documents', () => {
	const v2: OpenAPIV2.Document = {
		swagger: '2.0',
		info: { title: 't', version: '1' },
		paths: {},
	}
	expect(() => mergeOpenAPISpecs([v3DocA(), v2 as never])).toThrow()
})

test('merges v2 definitions and parameters with last-wins', () => {
	const a: OpenAPIV2.Document = {
		swagger: '2.0',
		info: { title: 'a', version: '1' },
		paths: { '/a': { get: { responses: { '200': { description: 'ok' } } } } },
		definitions: { Shared: { type: 'object', properties: { from: { type: 'string', enum: ['a'] } } } },
	}
	const b: OpenAPIV2.Document = {
		swagger: '2.0',
		info: { title: 'b', version: '2' },
		paths: { '/b': { get: { responses: { '200': { description: 'ok' } } } } },
		definitions: { Shared: { type: 'object', properties: { from: { type: 'string', enum: ['b'] } } } },
	}
	const collisions: MergeCollision[] = []
	const merged = mergeOpenAPISpecs([a, b], { onCollision: c => collisions.push(c) })
	expect(Object.keys(merged.paths).sort()).toEqual(['/a', '/b'])
	expect((merged.definitions!.Shared as OpenAPIV2.SchemaObject).properties!.from.enum).toEqual(['b'])
	expect(collisions).toContainEqual({ kind: 'definitions', key: 'Shared' })
})
