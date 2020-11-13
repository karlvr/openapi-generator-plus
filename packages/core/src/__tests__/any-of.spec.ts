import { createTestDocument } from './common'
import { idx } from '../'

test('any-of', async() => {
	const result = await createTestDocument('any-of/any-of.yml')

	const someObject = idx.find(result.models, m => m.name === 'SomeObject')
	expect(someObject).toBeDefined()
	expect(someObject!.isInterface).toBeFalsy()

	const submodels = idx.allValues(someObject?.models!)
	expect(submodels.length).toEqual(1)
	expect(submodels[0].isInterface).toBeFalsy()
	expect(submodels[0].implements).toBeDefined()
	expect(idx.size(submodels[0].implements!)).toEqual(2)

	expect(idx.size(submodels[0].properties!)).toEqual(5)
	for (const property of idx.values(submodels[0].properties!)) {
		expect(property.required).toBeFalsy()
	}
})
