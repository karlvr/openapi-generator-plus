import type { OpenAPI, OpenAPIV2, OpenAPIV3 } from 'openapi-types'
import { isOpenAPIV2Document, isOpenAPIV3Document } from './openapi-type-guards'

/** Identifies a colliding entry encountered while merging OpenAPI documents. */
export interface MergeCollision {
	/** Where the collision occurred, e.g. 'paths', 'components.schemas', 'definitions', 'tags'. */
	kind: string
	/** The key (path string, schema name, tag name, etc.) that collided. */
	key: string
}

export interface MergeOpenAPISpecsOptions {
	/** Invoked once per collision; the later spec's value will overwrite the earlier one. */
	onCollision?: (collision: MergeCollision) => void
}

const V3_COMPONENT_BUCKETS: Array<keyof OpenAPIV3.ComponentsObject> = [
	'schemas',
	'responses',
	'parameters',
	'examples',
	'requestBodies',
	'headers',
	'securitySchemes',
	'links',
	'callbacks',
]

const V2_BUCKETS = ['definitions', 'parameters', 'responses', 'securityDefinitions'] as const

/**
 * Merges multiple OpenAPI documents into a single document using last-wins semantics.
 *
 * - Top-level metadata (info, openapi/swagger version, servers, host, basePath, schemes,
 *   consumes, produces, externalDocs) is taken from the first document.
 * - paths and components.* (or v2 buckets) are unioned across documents; on collision the
 *   later document's value replaces the earlier one and onCollision is called.
 * - tags are unioned by name; later tags with the same name replace earlier ones.
 * - All documents must be the same major spec version (all v2 or all v3).
 */
export function mergeOpenAPISpecs<T extends OpenAPI.Document>(docs: T[], options?: MergeOpenAPISpecsOptions): T {
	if (docs.length === 0) {
		throw new Error('mergeOpenAPISpecs requires at least one document')
	}
	if (docs.length === 1) {
		return docs[0]
	}

	const first = docs[0]
	if (isOpenAPIV3Document(first)) {
		for (let i = 1; i < docs.length; i++) {
			if (!isOpenAPIV3Document(docs[i])) {
				throw new Error(`Cannot merge OpenAPI documents of different major versions (document ${i} is not OpenAPI v3)`)
			}
		}
		return mergeV3(docs as unknown as OpenAPIV3.Document[], options) as unknown as T
	}
	if (isOpenAPIV2Document(first)) {
		for (let i = 1; i < docs.length; i++) {
			if (!isOpenAPIV2Document(docs[i])) {
				throw new Error(`Cannot merge OpenAPI documents of different major versions (document ${i} is not Swagger v2)`)
			}
		}
		return mergeV2(docs as unknown as OpenAPIV2.Document[], options) as unknown as T
	}
	throw new Error('Unrecognised OpenAPI document version')
}

function mergeV3(docs: OpenAPIV3.Document[], options: MergeOpenAPISpecsOptions | undefined): OpenAPIV3.Document {
	const result: OpenAPIV3.Document = {
		...docs[0],
		paths: { ...(docs[0].paths || {}) },
	}

	if (docs[0].components) {
		result.components = cloneComponents(docs[0].components)
	}
	if (docs[0].tags) {
		result.tags = [...docs[0].tags]
	}

	for (let i = 1; i < docs.length; i++) {
		const doc = docs[i]

		if (doc.paths) {
			for (const path of Object.keys(doc.paths)) {
				if (Object.prototype.hasOwnProperty.call(result.paths, path)) {
					reportCollision(options, 'paths', path)
				}
				(result.paths as Record<string, unknown>)[path] = (doc.paths as Record<string, unknown>)[path]
			}
		}

		if (doc.components) {
			if (!result.components) {
				result.components = {}
			}
			for (const bucket of V3_COMPONENT_BUCKETS) {
				const incoming = doc.components[bucket] as Record<string, unknown> | undefined
				if (!incoming) {
					continue
				}
				const existing = (result.components[bucket] as Record<string, unknown> | undefined) || {}
				for (const name of Object.keys(incoming)) {
					if (Object.prototype.hasOwnProperty.call(existing, name)) {
						reportCollision(options, `components.${bucket}`, name)
					}
					existing[name] = incoming[name]
				}
				(result.components as Record<string, unknown>)[bucket] = existing
			}
		}

		if (doc.tags) {
			result.tags = mergeTags(result.tags, doc.tags, options)
		}
	}

	return result
}

function mergeV2(docs: OpenAPIV2.Document[], options: MergeOpenAPISpecsOptions | undefined): OpenAPIV2.Document {
	const result: OpenAPIV2.Document = {
		...docs[0],
		paths: { ...(docs[0].paths || {}) },
	}

	for (const bucket of V2_BUCKETS) {
		const initial = (docs[0] as unknown as Record<string, Record<string, unknown> | undefined>)[bucket]
		if (initial) {
			(result as unknown as Record<string, Record<string, unknown>>)[bucket] = { ...initial }
		}
	}
	if (docs[0].tags) {
		result.tags = [...docs[0].tags]
	}

	for (let i = 1; i < docs.length; i++) {
		const doc = docs[i]

		if (doc.paths) {
			for (const path of Object.keys(doc.paths)) {
				if (Object.prototype.hasOwnProperty.call(result.paths, path)) {
					reportCollision(options, 'paths', path)
				}
				(result.paths as Record<string, unknown>)[path] = (doc.paths as Record<string, unknown>)[path]
			}
		}

		for (const bucket of V2_BUCKETS) {
			const incoming = (doc as unknown as Record<string, Record<string, unknown> | undefined>)[bucket]
			if (!incoming) {
				continue
			}
			const existing = ((result as unknown as Record<string, Record<string, unknown> | undefined>)[bucket]) || {}
			for (const name of Object.keys(incoming)) {
				if (Object.prototype.hasOwnProperty.call(existing, name)) {
					reportCollision(options, bucket, name)
				}
				existing[name] = incoming[name]
			}
			(result as unknown as Record<string, Record<string, unknown>>)[bucket] = existing
		}

		if (doc.tags) {
			result.tags = mergeTags(result.tags, doc.tags, options)
		}
	}

	return result
}

function cloneComponents(components: OpenAPIV3.ComponentsObject): OpenAPIV3.ComponentsObject {
	const cloned: Record<string, Record<string, unknown>> = {}
	for (const bucket of V3_COMPONENT_BUCKETS) {
		const value = components[bucket] as Record<string, unknown> | undefined
		if (value) {
			cloned[bucket] = { ...value }
		}
	}
	return cloned as OpenAPIV3.ComponentsObject
}

function mergeTags<T extends { name: string }>(existing: T[] | undefined, incoming: T[], options: MergeOpenAPISpecsOptions | undefined): T[] {
	const result = existing ? [...existing] : []
	const indexByName = new Map<string, number>()
	for (let i = 0; i < result.length; i++) {
		indexByName.set(result[i].name, i)
	}
	for (const tag of incoming) {
		const idx = indexByName.get(tag.name)
		if (idx !== undefined) {
			reportCollision(options, 'tags', tag.name)
			result[idx] = tag
		} else {
			indexByName.set(tag.name, result.length)
			result.push(tag)
		}
	}
	return result
}

function reportCollision(options: MergeOpenAPISpecsOptions | undefined, kind: string, key: string): void {
	if (options?.onCollision) {
		options.onCollision({ kind, key })
	}
}
