import type { OpenAPI } from 'openapi-types'

function patternToRegex(pattern: string): RegExp {
	const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
	const body = escaped.replace(/\*/g, '.*')
	return new RegExp(`^${body}$`)
}

function removeInPlace(node: unknown, regexes: RegExp[]): void {
	if (node === null || node === undefined) {
		return
	}
	if (Array.isArray(node)) {
		for (const item of node) {
			removeInPlace(item, regexes)
		}
		return
	}
	if (typeof node !== 'object') {
		return
	}

	const obj = node as Record<string, unknown>
	for (const key of Object.keys(obj)) {
		if (key.startsWith('x-')) {
			const suffix = key.substring(2)
			if (regexes.some(r => r.test(suffix))) {
				delete obj[key]
				continue
			}
		}
		removeInPlace(obj[key], regexes)
	}
}

/**
 * Mutates the given OpenAPI document, removing vendor extension keys whose suffix (the part after
 * `x-`) matches any of the supplied glob-style `patterns`. Patterns support `*` as a wildcard
 * matching any character sequence; all other regex metacharacters are escaped.
 *
 * For example, the pattern `server-*` removes any key like `x-server-url`, `x-server-summary`, etc.,
 * while `server` only matches the bare key `x-server`. Only keys starting with `x-` are considered.
 *
 * The document is mutated in place so that any paired `$ref` resolver (e.g. one produced by
 * `createCodegenInput`) sees the removals. Callers who need the input untouched should clone
 * before calling.
 */
export function removeExtensionsFromOpenAPISpec<T extends OpenAPI.Document>(doc: T, patterns: string[]): T {
	if (!patterns || patterns.length === 0) {
		return doc
	}

	const regexes = patterns.map(patternToRegex)
	removeInPlace(doc, regexes)
	return doc
}
