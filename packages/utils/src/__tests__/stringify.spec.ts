import { stringify } from '../stringify'

test('stringify strings', () => {
	expect(stringify('one_two')).toEqual('"one_two"')
})

test('stringify simple objects', () => {
	expect(stringify({ one: 1, two: 2 })).toEqual('{"one":1,"two":2}')
})

interface TestObject {
	value: number
	nested: TestObject | null
}

test('stringify circular reference', () => {
	const ob: TestObject = {
		value: 1,
		nested: null,
	}
	ob.nested = ob
	expect(stringify(ob)).toEqual('{"value":1,"nested":"#REF:$"}')
})

interface TestObject2 {
	value: number
	nested: TestObject | null
}

test('stringify deep circular reference', () => {
	const ob: TestObject2 = {
		value: 1,
		nested: null,
	}
	ob.nested = {
		value: 2,
		nested: null,
	}
	ob.nested.nested = ob.nested
	expect(stringify(ob)).toEqual('{"value":1,"nested":{"value":2,"nested":"#REF:$.nested"}}')

	expect(stringify(ob, { depth: 1 })).toEqual('{"value":1,"nested":"PRUNED"}')

	/* If we prune to a depth, but the reference is at that depth, it survives */
	expect(stringify(ob, { depth: 2 })).toEqual('{"value":1,"nested":{"value":2,"nested":"#REF:$.nested"}}')
})

test('stringify depth', () => {
	const ob: TestObject2 = {
		value: 1,
		nested: {
			value: 2,
			nested: {
				value: 3,
				nested: null,
			},
		},
	}
	expect(stringify(ob, { depth: 1 })).toEqual('{"value":1,"nested":"PRUNED"}')
	expect(stringify(ob, { depth: 2 })).toEqual('{"value":1,"nested":{"value":2,"nested":"PRUNED"}}')
})
