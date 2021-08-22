export type IndexedType<K extends string, V> = Record<K, V>

type IndexedObjectType<T> = Record<string, T>

export function findEntry<T>(ob: IndexedObjectType<T>, predicate: (value: T) => unknown): [string, T] | undefined {
	for (const key in ob) {
		const value = ob[key]
		if (predicate(value)) {
			return [key, value]
		}
	}
	return undefined
}

export function find<T>(ob: IndexedObjectType<T>, predicate: (value: T) => boolean | undefined): T | undefined {
	for (const key in ob) {
		const value = ob[key]
		if (predicate(value)) {
			return value
		}
	}
	return undefined
}

export function filter<T>(ob: IndexedObjectType<T>, predicate: (value: T) => boolean | undefined): IndexedObjectType<T> {
	const result: IndexedObjectType<T> = {}
	for (const key in ob) {
		const value = ob[key]
		if (predicate(value)) {
			result[key] = value
		}
	}
	return result
}

export function isEmpty<T>(ob: IndexedObjectType<T>): boolean {
	return size(ob) === 0
}

function objectEntries<T>(ob: IndexedObjectType<T>): [string, T][] {
	const entries: [string, T][] = []
	for (const key in ob) {
		const value = ob[key]
		entries.push([key, value])
	}
	return entries
}

export function sortValues<T>(ob: IndexedObjectType<T>, compare: (a: T, b: T) => number): IndexedObjectType<T> {
	const entries = objectEntries(ob)
	entries.sort((a, b) => compare(a[1], b[1]))
	return create(entries)
}

export function iterable<T>(ob: IndexedObjectType<T>): Iterable<[string, T]> {
	return {
		[Symbol.iterator]: (): Iterator<[string, T]> => {
			let i = 0
			const keys = Object.keys(ob)
			return {
				next: (): IteratorResult<[string, T], undefined> => {
					const entry: [string, T] = [keys[i], ob[keys[i]]]
					i++

					if (i <= keys.length) {
						return {
							value: entry,
							done: false,
						}
					} else {
						return {
							value: undefined,
							done: true,
						}
					}
				},
			}
		},
	}
}

export function values<T>(ob: IndexedObjectType<T>): Iterable<T> {
	return {
		[Symbol.iterator]: (): Iterator<T> => {
			let i = 0
			const keys = Object.keys(ob)
			return {
				next: (): IteratorResult<T, undefined> => {
					const value = ob[keys[i]]
					i++

					if (i <= keys.length) {
						return {
							value,
							done: false,
						}
					} else {
						return {
							value: undefined,
							done: true,
						}
					}
				},
			}
		},
	}
}

export function remove<T>(ob: IndexedObjectType<T>, key: string): void {
	delete ob[key]
}

export function create<T>(): IndexedObjectType<T>
export function create<T>(entries: [string, T][]): IndexedObjectType<T>
export function create<T>(source: IndexedObjectType<T>): IndexedObjectType<T>
export function create<T>(entries?: [string, T][] | IndexedObjectType<T>): IndexedObjectType<T> {
	if (!entries) {
		return {}
	} else if (Array.isArray(entries)) {
		const result: IndexedObjectType<T> = {}
		for (const entry of entries) {
			result[entry[0]] = entry[1]
		}
		return result
	} else if (typeof entries === 'object') {
		const result: IndexedObjectType<T> = {}
		for (const name in entries) {
			result[name] = entries[name]
		}
		return result
	} else {
		throw new Error(`Unsupported argument to create: ${typeof entries}`)
	}
}

export function set<T, V extends T>(ob: IndexedObjectType<T>, key: string, value: V): void {
	ob[key] = value
}

export function get<T>(ob: IndexedObjectType<T>, key: string): T | undefined {
	return ob[key]
}

export function has<T>(ob: IndexedObjectType<T>, key: string): boolean {
	return Object.keys(ob).indexOf(key) !== -1
}

export function allKeys<T>(ob: IndexedObjectType<T>): string[] {
	const result: string[] = []
	for (const key in ob) {
		result.push(key)
	}
	return result
}

export function allValues<T>(ob: IndexedObjectType<T>): T[] {
	const result: T[] = []
	for (const key in ob) {
		result.push(ob[key])
	}
	return result
}

export function size<T>(ob: IndexedObjectType<T>): number {
	return Object.keys(ob).length
}

export function merge<T>(ob: IndexedObjectType<T>, other: IndexedObjectType<T>): IndexedObjectType<T> {
	for (const key in other) {
		ob[key] = other[key]
	}
	return ob
}

export function undefinedIfEmpty<T>(ob: IndexedObjectType<T> | undefined): IndexedObjectType<T> | undefined {
	if (!ob) {
		return undefined
	}
	if (isEmpty(ob)) {
		return undefined
	}
	return ob
}

export function nullIfEmpty<T>(ob: IndexedObjectType<T> | null): IndexedObjectType<T> | null {
	if (!ob) {
		return null
	}
	if (isEmpty(ob)) {
		return null
	}
	return ob
}
