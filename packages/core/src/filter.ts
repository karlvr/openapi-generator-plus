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

/** Returns the parts of a document outside its components that can refer to components. */
function seedRoots(doc: OpenAPI.Document): unknown[] {
	const roots: unknown[] = []
	const paths = (doc as OpenAPIV2.Document | OpenAPIV3.Document).paths
	if (paths) {
		roots.push(paths)
	}
	if ((doc as OpenAPIV3.Document).security) {
		roots.push((doc as OpenAPIV3.Document).security)
	}
	if ((doc as { webhooks?: unknown }).webhooks) {
		roots.push((doc as { webhooks?: unknown }).webhooks)
	}
	return roots
}

/**
 * The components of a document that the parts outside the components need, directly or through
 * other components. Use it to find the components that a filter leaves unused.
 *
 * A schema with a discriminator is polymorphic, and so is a schema that extends a polymorphic
 * schema with `allOf`. A value of a polymorphic schema can be any of its subtypes, and code
 * generation finds those subtypes from the `allOf` of each subtype. So when a reachable schema
 * uses a polymorphic schema as a type, its subtypes are reachable too, although nothing refers to
 * them. A schema that only extends a polymorphic schema does not make the other subtypes reachable.
 */
class ReachableComponents {
	/** The names of the reachable components, by bucket. */
	private readonly reachable = new Map<string, Set<string>>()
	/** The reachable schemas that a reference uses as a type, and not only as an `allOf` parent. */
	private readonly schemaTypes = new Set<string>()
	/** The memo of {@link isPolymorphic}. */
	private readonly polymorphic = new Map<string, boolean>()

	/**
	 * @param componentsRoot the object that holds a bucket of components for each prefix
	 * @param prefixes the prefixes of a reference to a component, with the bucket of each
	 * @param schemaBucket the bucket of the schemas
	 */
	constructor(
		private readonly componentsRoot: Record<string, Record<string, unknown> | undefined>,
		private readonly prefixes: RefPrefix[],
		private readonly schemaBucket: string,
	) {}

	/** Returns the names of the reachable components in a bucket. */
	names(bucket: string): ReadonlySet<string> {
		return this.reachable.get(bucket) || new Set<string>()
	}

	/**
	 * Marks the components that the nodes refer to as reachable, with each component that they
	 * need in turn, and the subtypes of the polymorphic schemas among them.
	 */
	addRefsIn(nodes: unknown[]): void {
		for (const node of nodes) {
			walkForRefs(node, this.prefixes, (bucket, name, inherited) => this.add(bucket, name, inherited))
		}
		this.addSubtypes()
	}

	/**
	 * Marks a component as reachable, with each component that it refers to.
	 * @param inherited true when the reference is a member of an `allOf`
	 */
	add(bucket: string, name: string, inherited = false): void {
		if (bucket === this.schemaBucket && !inherited) {
			this.schemaTypes.add(name)
		}
		let set = this.reachable.get(bucket)
		if (!set) {
			set = new Set<string>()
			this.reachable.set(bucket, set)
		}
		if (set.has(name)) {
			return
		}
		set.add(name)

		const target = this.componentsRoot[bucket]?.[name]
		if (target === undefined) {
			return
		}
		walkForRefs(target, this.prefixes, (b, n, i) => this.add(b, n, i))
	}

	/** Marks the subtypes of each polymorphic schema that a reachable component uses as a type. */
	private addSubtypes(): void {
		const subtypes = this.directSubtypes()
		let count = -1
		while (this.schemaTypes.size !== count) {
			count = this.schemaTypes.size
			for (const name of Array.from(this.schemaTypes)) {
				if (this.isPolymorphic(name, new Set())) {
					for (const subtype of subtypes.get(name) || []) {
						this.add(this.schemaBucket, subtype)
					}
				}
			}
		}
	}

	/** Returns the schemas that extend each schema directly with `allOf`, by the name of the schema that they extend. */
	private directSubtypes(): Map<string, string[]> {
		const result = new Map<string, string[]>()
		const schemas = this.componentsRoot[this.schemaBucket] || {}
		for (const name of Object.keys(schemas)) {
			for (const parent of this.allOfParents(schemas[name])) {
				const list = result.get(parent)
				if (list) {
					list.push(name)
				} else {
					result.set(parent, [name])
				}
			}
		}
		return result
	}

	/** Returns the names of the schemas that a schema extends with `allOf` references. */
	private allOfParents(schema: unknown): string[] {
		const allOf = schema && typeof schema === 'object' ? (schema as { allOf?: unknown }).allOf : undefined
		if (!Array.isArray(allOf)) {
			return []
		}
		const result: string[] = []
		for (const member of allOf) {
			const ref = member && typeof member === 'object' ? (member as { $ref?: unknown }).$ref : undefined
			if (typeof ref === 'string') {
				visitRef(ref, this.prefixes, (bucket, name) => {
					if (bucket === this.schemaBucket) {
						result.push(name)
					}
				})
			}
		}
		return result
	}

	/**
	 * Returns true when a schema has a discriminator, or extends a schema with a discriminator.
	 * @param visiting the schemas that the check is in, to stop at a cycle of `allOf` references
	 */
	private isPolymorphic(name: string, visiting: Set<string>): boolean {
		const known = this.polymorphic.get(name)
		if (known !== undefined) {
			return known
		}
		if (visiting.has(name)) {
			return false
		}
		visiting.add(name)
		const schema = this.componentsRoot[this.schemaBucket]?.[name]
		const result = (!!schema && typeof schema === 'object' && (schema as { discriminator?: unknown }).discriminator !== undefined)
			|| this.allOfParents(schema).some(parent => this.isPolymorphic(parent, visiting))
		this.polymorphic.set(name, result)
		return result
	}
}

function pruneOpenAPIV3Components(doc: OpenAPIV3.Document, anyOperationKept: boolean): void {
	if (!doc.components) {
		return
	}

	const componentsRoot = doc.components as unknown as Record<string, Record<string, unknown> | undefined>
	const reachable = new ReachableComponents(componentsRoot, V3_REF_PREFIXES, 'schemas')
	reachable.addRefsIn(seedRoots(doc))

	const usedSecuritySchemes = collectV3UsedSecuritySchemeNames(doc)
	for (const name of usedSecuritySchemes) {
		reachable.add('securitySchemes', name)
	}

	const components = doc.components
	for (const bucketKey of Object.keys(components) as Array<keyof OpenAPIV3.ComponentsObject>) {
		const bucket = components[bucketKey] as Record<string, unknown> | undefined
		if (!bucket || typeof bucket !== 'object') {
			continue
		}
		const reachableNames = reachable.names(bucketKey as string)
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
	const reachable = new ReachableComponents(doc as unknown as Record<string, Record<string, unknown> | undefined>, V2_REF_PREFIXES, 'definitions')
	reachable.addRefsIn(seedRoots(doc))

	const usedSecuritySchemes = collectV2UsedSecuritySchemeNames(doc)

	for (const { bucket } of V2_REF_PREFIXES) {
		const container = (doc as unknown as Record<string, Record<string, unknown> | undefined>)[bucket]
		if (!container || typeof container !== 'object') {
			continue
		}
		const reachableNames = reachable.names(bucket)
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

/**
 * Calls `visit` for each component that a node refers to. `inherited` is true when the reference is
 * a member of an `allOf`. A mapping of a discriminator also refers to components.
 */
function walkForRefs(node: unknown, prefixes: RefPrefix[], visit: (bucket: string, name: string, inherited: boolean) => void, inherited = false): void {
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
		visitRef(ref, prefixes, (bucket, name) => visit(bucket, name, inherited))
		return
	}

	for (const key in obj) {
		const value = obj[key]
		if (key === 'allOf' && Array.isArray(value)) {
			for (const member of value) {
				walkForRefs(member, prefixes, visit, true)
			}
			continue
		}
		if (key === 'discriminator') {
			visitDiscriminatorMapping(value, prefixes, visit)
		}
		walkForRefs(value, prefixes, visit)
	}
}

/** Calls `visit` with the bucket and the name of the component that a reference points to, if it points to a component. */
function visitRef(ref: string, prefixes: RefPrefix[], visit: (bucket: string, name: string) => void): void {
	for (const { prefix, bucket } of prefixes) {
		if (ref.startsWith(prefix)) {
			visit(bucket, decodeURIComponent(ref.substring(prefix.length)))
			return
		}
	}
}

/**
 * Calls `visit` for each schema in the mapping of an OpenAPI 3 discriminator. A mapping value is a
 * reference, or the name of a schema in the components.
 */
function visitDiscriminatorMapping(discriminator: unknown, prefixes: RefPrefix[], visit: (bucket: string, name: string, inherited: boolean) => void): void {
	const mapping = discriminator && typeof discriminator === 'object' ? (discriminator as { mapping?: unknown }).mapping : undefined
	if (!mapping || typeof mapping !== 'object') {
		return
	}
	const schemaPrefix = prefixes.find(p => p.bucket === 'schemas')
	for (const value of Object.values(mapping as Record<string, unknown>)) {
		if (typeof value !== 'string') {
			continue
		}
		const ref = value.indexOf('/') === -1 && schemaPrefix ? `${schemaPrefix.prefix}${value}` : value
		visitRef(ref, prefixes, (bucket, name) => visit(bucket, name, false))
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
