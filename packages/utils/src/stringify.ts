export interface StringifyOptions {
	space?: string | number
	depth?: number
}

/**
 * Stringify a value using JSON.stringify, but supporting circular data structures and depth pruning
 * @param value 
 * @param options 
 * @returns 
 */
export function stringify(value: unknown, options: StringifyOptions = {}): string {
	if (value === undefined) {
		return 'undefined'
	} else {
		return JSON.stringify(value, refReplacer(options), options.space)
	}
}

export function debugStringify(value: unknown): string {
	return stringify(value, { depth: 2, space: 2 })
}

/**
 * A replacer function for `JSON.stringify` that manages cycles.
 * Based on https://stackoverflow.com/a/61749783/1951952
 */
function refReplacer(options: StringifyOptions) {
	// eslint-disable-next-line @typescript-eslint/ban-types
	const paths = new Map<object, string>()
	let initial: unknown | undefined

	// eslint-disable-next-line @typescript-eslint/ban-types
	return function(this: object, field: string, value: unknown) {
		if (!value || typeof value !== 'object' || value === null) {
			return value
		}

		const knownPath = paths.get(value)
		if (knownPath) {
			return `#REF:${knownPath}`
		}

		if (initial == undefined) {
			initial = value
			paths.set(this, '$')
		}

		const path = `${paths.get(this)}${field ? (Array.isArray(this) ? `[${field}]` : `.${field}`) : ''}`
		paths.set(value, path)

		if (options.depth !== undefined && typeof value === 'object') {
			const pathDepth = path.split('.').length
			if (pathDepth > options.depth) {
				return 'PRUNED'
			}
		}

		return value
	}
}
