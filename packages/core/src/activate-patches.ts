import type { OpenAPI } from 'openapi-types'

function activateInPlace(node: unknown, prefix: string): void {
	if (node === null || node === undefined) {
		return
	}
	if (Array.isArray(node)) {
		for (const item of node) {
			activateInPlace(item, prefix)
		}
		return
	}
	if (typeof node !== 'object') {
		return
	}

	const obj = node as Record<string, unknown>

	const matchingKeys: string[] = []
	for (const key in obj) {
		if (key.length > prefix.length && key.startsWith(prefix)) {
			matchingKeys.push(key)
		}
	}
	for (const key of matchingKeys) {
		const targetKey = key.substring(prefix.length)
		obj[targetKey] = obj[key]
		delete obj[key]
	}

	for (const key in obj) {
		activateInPlace(obj[key], prefix)
	}
}

/**
 * Mutates the given OpenAPI document, promoting `x-{name}-` extension keys to their underlying key
 * for each name in `names`, replacing any existing value at that key.
 *
 * Each name is processed in order with a full recursive walk, so a sequence like ["server", "client"]
 * will activate `x-server-` first and then `x-client-`. Promoted values are themselves traversed,
 * so nested promotions (e.g. `x-server-foo: { x-server-bar: 1 }` → `foo: { bar: 1 }`) work in one pass.
 *
 * The document is mutated in place so that any paired `$ref` resolver (e.g. one produced by
 * `createCodegenInput`) sees the rewrites. Callers who need the input untouched should clone
 * before calling.
 */
export function activatePatchesInOpenAPISpec<T extends OpenAPI.Document>(doc: T, names: string[]): T {
	if (!names || names.length === 0) {
		return doc
	}

	for (const name of names) {
		activateInPlace(doc, `x-${name}-`)
	}
	return doc
}
