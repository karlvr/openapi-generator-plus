module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	/* testRegex so we don't run tests in the dist directory */
	testRegex: '(/__tests__/.*|/src/.*(\\.|/)(test|spec))\\.[jt]sx?$',
}