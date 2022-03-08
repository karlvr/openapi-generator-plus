import { isURL } from '../utils'

test('isUrl accepts valid URLs', async() => {
	expect(isURL('https://github.com')).toBeTruthy()
	expect(isURL('ftp://github.com')).toBeTruthy()
	expect(isURL('mailto:karl@example.com')).toBeTruthy()
	expect(isURL('validVALID01232456789+.-:ok')).toBeTruthy()
})

test('isUrl rejects invalid URLs', async() => {
	expect(isURL('github.com')).toBeFalsy()
	expect(isURL('!://github.com')).toBeFalsy()
	expect(isURL(' :karl@example.com')).toBeFalsy()
})
