import { camelCase } from '../src/case-transforms'

test('camelCase', () => {
	expect(camelCase('one_two')).toBe('oneTwo')
	expect(camelCase('one__two')).toBe('oneTwo')
})

test('camelCase preserves case', () => {
	expect(camelCase('FAQ_section')).toBe('FAQSection')
	expect(camelCase('FAQ-section')).toBe('FAQSection')
	expect(camelCase('FAQSection')).toBe('FAQSection')
	expect(camelCase('One_two')).toBe('OneTwo')
})
