interface IndexedObjectsType<T> {
	[key: string]: T
}

export function findEntry<T>(ob: IndexedObjectsType<T>, predicate: (value: T) => unknown): [string, T] | undefined {
	for (const key in ob) {
		const value = ob[key]
		if (predicate(value)) {
			return [key, value]
		}
	}
	return undefined
}

export function find<T>(ob: IndexedObjectsType<T>, predicate: (value: T) => boolean | undefined): T | undefined {
	for (const key in ob) {
		const value = ob[key]
		if (predicate(value)) {
			return value
		}
	}
	return undefined
}

export function filter<T>(ob: IndexedObjectsType<T>, predicate: (value: T) => boolean | undefined): IndexedObjectsType<T> {
	const result: IndexedObjectsType<T> = {}
	for (const key in ob) {
		const value = ob[key]
		if (predicate(value)) {
			result[key] = value
		}
	}
	return result
}

export function filterToNothing<T>(ob: IndexedObjectsType<T>, predicate: (value: T) => boolean | undefined): IndexedObjectsType<T> | undefined {
	const filtered = filter(ob, predicate)
	return empty(filtered) ? undefined : filtered
}

function empty<T>(ob: IndexedObjectsType<T>): boolean {
	return size(ob) === 0
}

function objectEntries<T>(ob: IndexedObjectsType<T>): [string, T][] {
	const entries: [string, T][] = []
	for (const key in ob) {
		const value = ob[key]
		entries.push([key, value])
	}
	return entries
}

export function sortValues<T>(ob: IndexedObjectsType<T>, compare: (a: T, b: T) => number): IndexedObjectsType<T> {
	const entries = objectEntries(ob)
	entries.sort((a, b) => compare(a[1], b[1]))
	return create(entries)
}

export function iterable<T>(ob: IndexedObjectsType<T>): Iterable<[string, T]> {
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

export function remove<T>(ob: IndexedObjectsType<T>, key: string) {
	delete ob[key]
}

export function create<T>(entries?: [string, T][]): IndexedObjectsType<T> {
	const result: IndexedObjectsType<T> = {}
	if (entries) {
		for (const entry of entries) {
			result[entry[0]] = entry[1]
		}
	}
	return result
}

export function set<T>(ob: IndexedObjectsType<T>, key: string, value: T) {
	ob[key] = value
}

export function get<T>(ob: IndexedObjectsType<T>, key: string): T | undefined {
	return ob[key]
}

export function values<T>(ob: IndexedObjectsType<T>): T[] {
	const result: T[] = []
	for (const key in ob) {
		result.push(ob[key])
	}
	return result
}

export function size<T>(ob: IndexedObjectsType<T>): number {
	return Object.keys(ob).length
}
