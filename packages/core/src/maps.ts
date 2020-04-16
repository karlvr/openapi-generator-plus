export function findEntry<K, V>(map: Map<K, V>, predicate: (value: V) => unknown): [K, V] | undefined {
	for (const entry of map) {
		if (predicate(entry[1])) {
			return entry
		}
	}
	return undefined
}

export function find<K, V>(map: Map<K, V>, predicate: (value: V) => boolean | undefined): V | undefined {
	for (const entry of map) {
		if (predicate(entry[1])) {
			return entry[1]
		}
	}
	return undefined
}

export function filter<K, V>(map: Map<K, V>, predicate: (value: V) => boolean | undefined): Map<K, V> {
	const result: Map<K, V> = new Map()
	for (const entry of map) {
		if (predicate(entry[1])) {
			result.set(entry[0], entry[1])
		}
	}
	return result
}

export function filterToNothing<K, V>(map: Map<K, V>, predicate: (value: V) => boolean | undefined): Map<K, V> | undefined {
	const filtered = filter(map, predicate)
	return isEmpty(filtered) ? undefined : filtered
}

export function isEmpty<K, V>(map: Map<K, V>): boolean {
	return size(map) === 0
}

export function sortValues<K, V>(map: Map<K, V>, compare: (a: V, b: V) => number): Map<K, V> {
	return new Map([...map.entries()].sort((a, b) => compare(a[1], b[1])))
}

export function iterable<K, V>(map: Map<K, V>): Iterable<[K, V]> {
	return map
}

export function values<K, V>(map: Map<K, V>): Iterable<V> {
	return map.values()
}

export function remove<K, V>(map: Map<K, V>, key: K) {
	map.delete(key)
}

export function create<K, V>(entries?: [K, V][]): Map<K, V> {
	if (!entries) {
		return new Map()
	} else {
		return new Map(entries)
	}
}

export function set<K, V>(map: Map<K, V>, key: K, value: V) {
	map.set(key, value)
}

export function get<K, V>(map: Map<K, V>, key: K): V | undefined {
	return map.get(key)
}

export function allValues<K, V>(map: Map<K, V>): V[] {
	return [...map.values()]
}

export function size<K, V>(map: Map<K, V>): number {
	return map.size
}

export function merge<K, V>(map: Map<K, V>, other: Map<K, V>): Map<K, V> {
	for (const entry of other) {
		map.set(entry[0], entry[1])
	}
	return map
}
