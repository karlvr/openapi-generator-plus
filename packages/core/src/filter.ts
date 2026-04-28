import type { OpenAPI, OpenAPIV2, OpenAPIV3 } from 'openapi-types'
import { minimatch } from 'minimatch'
import { isOpenAPIV2Document, isOpenAPIV3Document } from './openapi-type-guards'

/**
 * Options for filtering an OpenAPI document. Each list is treated as a set of matchers; an
 * operation is kept when it matches the include rules (if any) and does not match the exclude rules.
 *
 * Path patterns are matched against the OpenAPI path string (e.g. "/users/{id}") using glob syntax,
 * so "/users/*" matches "/users/{id}" and "/users/**" matches any descendant path.
 */
export interface OpenAPIFilters {
	/** Keep operations tagged with any of these tags. If empty/undefined, no tag include filter is applied. */
	includeTags?: string[]
	/** Drop operations tagged with any of these tags. */
	excludeTags?: string[]
	/** Keep operations whose path matches any of these glob patterns. If empty/undefined, no path include filter is applied. */
	includePaths?: string[]
	/** Drop operations whose path matches any of these glob patterns. */
	excludePaths?: string[]
}

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const
type HttpMethod = typeof HTTP_METHODS[number]

function hasAnyFilter(filters: OpenAPIFilters): boolean {
	return !!(filters.includeTags?.length || filters.excludeTags?.length || filters.includePaths?.length || filters.excludePaths?.length)
}

function matchesAny(value: string, patterns: string[] | undefined, glob: boolean): boolean {
	if (!patterns || patterns.length === 0) {
		return false
	}
	for (const pattern of patterns) {
		if (glob) {
			if (minimatch(value, pattern)) {
				return true
			}
		} else if (value === pattern) {
			return true
		}
	}
	return false
}

function operationMatchesTagFilter(op: OpenAPI.Operation, filters: OpenAPIFilters): boolean {
	const baseTags = Array.isArray(op.tags) ? (op.tags as unknown[]).filter((t): t is string => typeof t === 'string') : []
	const xTags = getXTags(op as unknown) || []
	const tags = [...baseTags, ...xTags]
	if (filters.includeTags && filters.includeTags.length > 0) {
		const matched = tags.some(t => filters.includeTags!.indexOf(t) !== -1)
		if (!matched) {
			return false
		}
	}
	if (filters.excludeTags && filters.excludeTags.length > 0) {
		const matched = tags.some(t => filters.excludeTags!.indexOf(t) !== -1)
		if (matched) {
			return false
		}
	}
	return true
}

function hasTagFilter(filters: OpenAPIFilters): boolean {
	return !!(filters.includeTags?.length || filters.excludeTags?.length)
}

function getXTags(node: unknown): string[] | undefined {
	if (!node || typeof node !== 'object' || Array.isArray(node)) {
		return undefined
	}
	const value = (node as Record<string, unknown>)['x-tags']
	if (typeof value === 'string') {
		return [value]
	}
	if (!Array.isArray(value)) {
		return undefined
	}
	const tags = value.filter((t): t is string => typeof t === 'string')
	return tags.length === 0 ? undefined : tags
}

/**
 * Decide whether a sub-operation node is removed based on its `x-tags` extension.
 * A node with no `x-tags` is kept (it inherits the enclosing operation's filtering decision).
 * If `x-tags` is present, the include/exclude filters are evaluated against those `x-tags` alone.
 */
function shouldRemoveNode(node: unknown, filters: OpenAPIFilters): boolean {
	const xTags = getXTags(node)
	if (!xTags) {
		return false
	}
	if (filters.includeTags && filters.includeTags.length > 0) {
		if (!xTags.some(t => filters.includeTags!.indexOf(t) !== -1)) {
			return true
		}
	}
	if (filters.excludeTags && filters.excludeTags.length > 0) {
		if (xTags.some(t => filters.excludeTags!.indexOf(t) !== -1)) {
			return true
		}
	}
	return false
}

function filterSchemaInPlace(schema: unknown, filters: OpenAPIFilters): void {
	if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
		return
	}
	const s = schema as Record<string, unknown>
	if (typeof s.$ref === 'string') {
		return
	}

	const props = s.properties
	if (props && typeof props === 'object' && !Array.isArray(props)) {
		const propsObj = props as Record<string, unknown>
		const required = Array.isArray(s.required) ? (s.required as unknown[]).filter((r): r is string => typeof r === 'string') : undefined
		let requiredChanged = false
		for (const name of Object.keys(propsObj)) {
			if (shouldRemoveNode(propsObj[name], filters)) {
				delete propsObj[name]
				if (required) {
					const idx = required.indexOf(name)
					if (idx !== -1) {
						required.splice(idx, 1)
						requiredChanged = true
					}
				}
			} else {
				filterSchemaInPlace(propsObj[name], filters)
			}
		}
		if (requiredChanged) {
			if (required && required.length > 0) {
				s.required = required
			} else {
				delete s.required
			}
		}
	}

	filterSchemaInPlace(s.items, filters)
	if (s.additionalProperties && typeof s.additionalProperties === 'object') {
		filterSchemaInPlace(s.additionalProperties, filters)
	}
	for (const key of ['allOf', 'oneOf', 'anyOf'] as const) {
		const arr = s[key]
		if (Array.isArray(arr)) {
			for (const sub of arr) {
				filterSchemaInPlace(sub, filters)
			}
		}
	}
	filterSchemaInPlace(s.not, filters)
}

function filterParameterNodeInPlace(param: unknown, filters: OpenAPIFilters): void {
	if (!param || typeof param !== 'object' || Array.isArray(param)) {
		return
	}
	const p = param as Record<string, unknown>
	if (typeof p.$ref === 'string') {
		return
	}
	filterSchemaInPlace(p.schema, filters)
}

function filterParametersInPlace(holder: Record<string, unknown>, filters: OpenAPIFilters): void {
	const params = holder.parameters
	if (!Array.isArray(params)) {
		return
	}
	const kept: unknown[] = []
	for (const p of params) {
		if (shouldRemoveNode(p, filters)) {
			continue
		}
		filterParameterNodeInPlace(p, filters)
		kept.push(p)
	}
	if (kept.length === 0) {
		delete holder.parameters
	} else {
		holder.parameters = kept
	}
}

function filterContentMapInPlace(holder: Record<string, unknown>, filters: OpenAPIFilters): void {
	const content = holder.content
	if (!content || typeof content !== 'object' || Array.isArray(content)) {
		return
	}
	const contentObj = content as Record<string, unknown>
	for (const mediaType of Object.keys(contentObj)) {
		const entry = contentObj[mediaType]
		if (shouldRemoveNode(entry, filters)) {
			delete contentObj[mediaType]
			continue
		}
		if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
			filterSchemaInPlace((entry as Record<string, unknown>).schema, filters)
		}
	}
	if (Object.keys(contentObj).length === 0) {
		delete holder.content
	}
}

function filterRequestBodyInPlace(operation: Record<string, unknown>, filters: OpenAPIFilters): void {
	const rb = operation.requestBody
	if (!rb || typeof rb !== 'object' || Array.isArray(rb)) {
		return
	}
	if (shouldRemoveNode(rb, filters)) {
		delete operation.requestBody
		return
	}
	const rbObj = rb as Record<string, unknown>
	if (typeof rbObj.$ref === 'string') {
		return
	}
	filterContentMapInPlace(rbObj, filters)
}

function filterResponsesInPlace(operation: Record<string, unknown>, filters: OpenAPIFilters, isV3: boolean): void {
	const responses = operation.responses
	if (!responses || typeof responses !== 'object' || Array.isArray(responses)) {
		return
	}
	const responsesObj = responses as Record<string, unknown>
	for (const code of Object.keys(responsesObj)) {
		const resp = responsesObj[code]
		if (shouldRemoveNode(resp, filters)) {
			delete responsesObj[code]
			continue
		}
		if (!resp || typeof resp !== 'object' || Array.isArray(resp)) {
			continue
		}
		const respObj = resp as Record<string, unknown>
		if (typeof respObj.$ref === 'string') {
			continue
		}
		if (isV3) {
			filterContentMapInPlace(respObj, filters)
		} else {
			filterSchemaInPlace(respObj.schema, filters)
		}
	}
}

function applyXTagsToOperation(op: Record<string, unknown>, filters: OpenAPIFilters, isV3: boolean): void {
	filterParametersInPlace(op, filters)
	if (isV3) {
		filterRequestBodyInPlace(op, filters)
	}
	filterResponsesInPlace(op, filters, isV3)
}

function applyXTagsToV3Components(doc: OpenAPIV3.Document, filters: OpenAPIFilters): void {
	if (!doc.components) {
		return
	}
	const c = doc.components
	if (c.schemas) {
		for (const name of Object.keys(c.schemas)) {
			filterSchemaInPlace(c.schemas[name], filters)
		}
	}
	if (c.parameters) {
		for (const name of Object.keys(c.parameters)) {
			filterParameterNodeInPlace(c.parameters[name], filters)
		}
	}
	if (c.requestBodies) {
		for (const name of Object.keys(c.requestBodies)) {
			const rb = c.requestBodies[name] as unknown as Record<string, unknown> | undefined
			if (rb) {
				filterContentMapInPlace(rb, filters)
			}
		}
	}
	if (c.responses) {
		for (const name of Object.keys(c.responses)) {
			const resp = c.responses[name] as unknown as Record<string, unknown> | undefined
			if (resp) {
				filterContentMapInPlace(resp, filters)
			}
		}
	}
}

function applyXTagsToV2SharedDefinitions(doc: OpenAPIV2.Document, filters: OpenAPIFilters): void {
	if (doc.definitions) {
		for (const name of Object.keys(doc.definitions)) {
			filterSchemaInPlace(doc.definitions[name], filters)
		}
	}
	if (doc.parameters) {
		for (const name of Object.keys(doc.parameters)) {
			filterParameterNodeInPlace(doc.parameters[name], filters)
		}
	}
	if (doc.responses) {
		for (const name of Object.keys(doc.responses)) {
			const resp = doc.responses[name] as unknown as Record<string, unknown> | undefined
			if (resp) {
				filterSchemaInPlace(resp.schema, filters)
			}
		}
	}
}

function pathMatchesPathFilter(path: string, filters: OpenAPIFilters): boolean {
	if (filters.includePaths && filters.includePaths.length > 0) {
		if (!matchesAny(path, filters.includePaths, true)) {
			return false
		}
	}
	if (filters.excludePaths && filters.excludePaths.length > 0) {
		if (matchesAny(path, filters.excludePaths, true)) {
			return false
		}
	}
	return true
}

/**
 * Mutates the given OpenAPI document, filtering operations by tag and path, pruning unused
 * components/definitions, and removing unused root-level tags. Operations with no tags are
 * dropped when an includeTags filter is set, since they cannot satisfy a "match any" rule.
 *
 * The document is mutated in place so that any paired `$ref` resolver (e.g. one produced by
 * `createCodegenInput`) sees the filtered tree. Callers who need the input untouched should
 * clone before calling.
 */
export function filterOpenAPISpec<T extends OpenAPI.Document>(doc: T, filters: OpenAPIFilters): T {
	if (!hasAnyFilter(filters)) {
		return doc
	}

	const newPaths: Record<string, unknown> = {}
	const sourcePaths = (doc as OpenAPIV2.Document | OpenAPIV3.Document).paths || {}
	const isV3 = isOpenAPIV3Document(doc)
	const applyXTags = hasTagFilter(filters)

	let anyOperationKept = false

	for (const path in sourcePaths) {
		if (!pathMatchesPathFilter(path, filters)) {
			continue
		}

		const pathItem = sourcePaths[path]
		if (!pathItem || typeof pathItem !== 'object') {
			continue
		}

		const newPathItem: Record<string, unknown> = {}
		let kept = false

		for (const key in pathItem) {
			const value = (pathItem as Record<string, unknown>)[key]
			if (HTTP_METHODS.indexOf(key as HttpMethod) !== -1) {
				const op = value as OpenAPI.Operation | undefined
				if (op && operationMatchesTagFilter(op, filters)) {
					if (applyXTags) {
						applyXTagsToOperation(op as unknown as Record<string, unknown>, filters, isV3)
					}
					newPathItem[key] = op
					kept = true
				}
			} else {
				newPathItem[key] = value
			}
		}

		if (kept && applyXTags) {
			filterParametersInPlace(newPathItem, filters)
		}

		if (kept) {
			newPaths[path] = newPathItem
			anyOperationKept = true
		}
	}

	(doc as OpenAPIV2.Document | OpenAPIV3.Document).paths = newPaths as OpenAPIV2.PathsObject & OpenAPIV3.PathsObject

	if (isOpenAPIV3Document(doc)) {
		if (applyXTags) {
			applyXTagsToV3Components(doc, filters)
		}
		pruneOpenAPIV3Components(doc, anyOperationKept)
	} else if (isOpenAPIV2Document(doc)) {
		if (applyXTags) {
			applyXTagsToV2SharedDefinitions(doc, filters)
		}
		pruneOpenAPIV2Definitions(doc, anyOperationKept)
	}

	pruneRootTags(doc)

	return doc
}

function pruneRootTags(doc: OpenAPI.Document): void {
	const tagsContainer = doc as { tags?: Array<{ name: string }> }
	if (!Array.isArray(tagsContainer.tags) || tagsContainer.tags.length === 0) {
		return
	}

	const usedTagNames = collectUsedTagNames(doc)
	tagsContainer.tags = tagsContainer.tags.filter(t => usedTagNames.has(t.name))
	if (tagsContainer.tags.length === 0) {
		delete tagsContainer.tags
	}
}

function collectUsedTagNames(doc: OpenAPI.Document): Set<string> {
	const used = new Set<string>()
	const paths = (doc as OpenAPIV2.Document | OpenAPIV3.Document).paths || {}
	for (const path in paths) {
		const pathItem = paths[path] as Record<string, unknown> | undefined
		if (!pathItem) {
			continue
		}
		for (const method of HTTP_METHODS) {
			const op = pathItem[method] as OpenAPI.Operation | undefined
			if (op && op.tags) {
				for (const t of op.tags) {
					used.add(t)
				}
			}
		}
	}
	return used
}

interface RefPrefix {
	prefix: string
	bucket: string
}

const V3_REF_PREFIXES: RefPrefix[] = [
	{ prefix: '#/components/schemas/', bucket: 'schemas' },
	{ prefix: '#/components/responses/', bucket: 'responses' },
	{ prefix: '#/components/parameters/', bucket: 'parameters' },
	{ prefix: '#/components/examples/', bucket: 'examples' },
	{ prefix: '#/components/requestBodies/', bucket: 'requestBodies' },
	{ prefix: '#/components/headers/', bucket: 'headers' },
	{ prefix: '#/components/links/', bucket: 'links' },
	{ prefix: '#/components/callbacks/', bucket: 'callbacks' },
	{ prefix: '#/components/securitySchemes/', bucket: 'securitySchemes' },
]

const V2_REF_PREFIXES: RefPrefix[] = [
	{ prefix: '#/definitions/', bucket: 'definitions' },
	{ prefix: '#/parameters/', bucket: 'parameters' },
	{ prefix: '#/responses/', bucket: 'responses' },
]

function pruneOpenAPIV3Components(doc: OpenAPIV3.Document, anyOperationKept: boolean): void {
	if (!doc.components) {
		return
	}

	const reachable = computeReachable(doc, V3_REF_PREFIXES)

	const componentsRoot = doc.components as unknown as Record<string, Record<string, unknown> | undefined>

	const usedSecuritySchemes = collectV3UsedSecuritySchemeNames(doc)
	for (const name of usedSecuritySchemes) {
		addReachable(reachable, 'securitySchemes', name, componentsRoot, V3_REF_PREFIXES)
	}

	const components = doc.components
	for (const bucketKey of Object.keys(components) as Array<keyof OpenAPIV3.ComponentsObject>) {
		const bucket = components[bucketKey] as Record<string, unknown> | undefined
		if (!bucket || typeof bucket !== 'object') {
			continue
		}
		const reachableNames = reachable.get(bucketKey as string) || new Set<string>()
		for (const name of Object.keys(bucket)) {
			if (!reachableNames.has(name)) {
				delete bucket[name]
			}
		}
		if (Object.keys(bucket).length === 0) {
			delete components[bucketKey]
		}
	}

	if (Object.keys(components).length === 0) {
		delete doc.components
	}

	if (!anyOperationKept && doc.security) {
		delete doc.security
	}
}

function pruneOpenAPIV2Definitions(doc: OpenAPIV2.Document, anyOperationKept: boolean): void {
	const reachable = computeReachable(doc, V2_REF_PREFIXES)

	const usedSecuritySchemes = collectV2UsedSecuritySchemeNames(doc)

	for (const { bucket } of V2_REF_PREFIXES) {
		const container = (doc as unknown as Record<string, Record<string, unknown> | undefined>)[bucket]
		if (!container || typeof container !== 'object') {
			continue
		}
		const reachableNames = reachable.get(bucket) || new Set<string>()
		for (const name of Object.keys(container)) {
			if (!reachableNames.has(name)) {
				delete container[name]
			}
		}
		if (Object.keys(container).length === 0) {
			delete (doc as unknown as Record<string, unknown>)[bucket]
		}
	}

	if (doc.securityDefinitions) {
		for (const name of Object.keys(doc.securityDefinitions)) {
			if (!usedSecuritySchemes.has(name)) {
				delete doc.securityDefinitions[name]
			}
		}
		if (Object.keys(doc.securityDefinitions).length === 0) {
			delete doc.securityDefinitions
		}
	}

	if (!anyOperationKept && doc.security) {
		delete doc.security
	}
}

function computeReachable(doc: OpenAPI.Document, prefixes: RefPrefix[]): Map<string, Set<string>> {
	const reachable = new Map<string, Set<string>>()

	const componentsRoot = getComponentsRoot(doc, prefixes)

	const seedRoots: unknown[] = []
	const paths = (doc as OpenAPIV2.Document | OpenAPIV3.Document).paths
	if (paths) {
		seedRoots.push(paths)
	}
	if ((doc as OpenAPIV3.Document).security) {
		seedRoots.push((doc as OpenAPIV3.Document).security)
	}
	if ((doc as { webhooks?: unknown }).webhooks) {
		seedRoots.push((doc as { webhooks?: unknown }).webhooks)
	}

	for (const root of seedRoots) {
		walkForRefs(root, prefixes, (bucket, name) => addReachable(reachable, bucket, name, componentsRoot, prefixes))
	}

	return reachable
}

function getComponentsRoot(doc: OpenAPI.Document, prefixes: RefPrefix[]): Record<string, Record<string, unknown> | undefined> {
	if (prefixes === V3_REF_PREFIXES) {
		return ((doc as OpenAPIV3.Document).components || {}) as Record<string, Record<string, unknown> | undefined>
	}
	return doc as unknown as Record<string, Record<string, unknown> | undefined>
}

function addReachable(
	reachable: Map<string, Set<string>>,
	bucket: string,
	name: string,
	componentsRoot: Record<string, Record<string, unknown> | undefined>,
	prefixes: RefPrefix[],
): void {
	let set = reachable.get(bucket)
	if (!set) {
		set = new Set<string>()
		reachable.set(bucket, set)
	}
	if (set.has(name)) {
		return
	}
	set.add(name)

	const container = componentsRoot[bucket]
	if (!container) {
		return
	}
	const target = container[name]
	if (target === undefined) {
		return
	}
	walkForRefs(target, prefixes, (b, n) => addReachable(reachable, b, n, componentsRoot, prefixes))
}

function walkForRefs(node: unknown, prefixes: RefPrefix[], visit: (bucket: string, name: string) => void): void {
	if (node === null || node === undefined) {
		return
	}
	if (Array.isArray(node)) {
		for (const item of node) {
			walkForRefs(item, prefixes, visit)
		}
		return
	}
	if (typeof node !== 'object') {
		return
	}

	const obj = node as Record<string, unknown>
	const ref = obj.$ref
	if (typeof ref === 'string') {
		for (const { prefix, bucket } of prefixes) {
			if (ref.startsWith(prefix)) {
				const name = decodeURIComponent(ref.substring(prefix.length))
				visit(bucket, name)
				return
			}
		}
		return
	}

	for (const key in obj) {
		walkForRefs(obj[key], prefixes, visit)
	}
}

function collectV3UsedSecuritySchemeNames(doc: OpenAPIV3.Document): Set<string> {
	const used = new Set<string>()
	const collect = (req: OpenAPIV3.SecurityRequirementObject[] | undefined) => {
		if (!req) {
			return
		}
		for (const r of req) {
			for (const name of Object.keys(r)) {
				used.add(name)
			}
		}
	}
	collect(doc.security)
	const paths = doc.paths || {}
	for (const p in paths) {
		const pathItem = paths[p] as OpenAPIV3.PathItemObject | undefined
		if (!pathItem) {
			continue
		}
		for (const method of HTTP_METHODS) {
			const op = pathItem[method as HttpMethod] as OpenAPIV3.OperationObject | undefined
			if (op) {
				collect(op.security)
			}
		}
	}
	return used
}

function collectV2UsedSecuritySchemeNames(doc: OpenAPIV2.Document): Set<string> {
	const used = new Set<string>()
	const collect = (req: OpenAPIV2.SecurityRequirementObject[] | undefined) => {
		if (!req) {
			return
		}
		for (const r of req) {
			for (const name of Object.keys(r)) {
				used.add(name)
			}
		}
	}
	collect(doc.security)
	const paths = doc.paths || {}
	for (const p in paths) {
		const pathItem = paths[p] as Record<string, unknown> | undefined
		if (!pathItem) {
			continue
		}
		for (const method of HTTP_METHODS) {
			const op = pathItem[method] as OpenAPIV2.OperationObject | undefined
			if (op) {
				collect(op.security)
			}
		}
	}
	return used
}
