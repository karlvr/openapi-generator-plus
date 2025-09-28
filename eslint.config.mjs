import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import stylistic from '@stylistic/eslint-plugin'

export default tseslint.config(
	{ ignores: ['dist'] },
	{
		extends: [js.configs.recommended, ...tseslint.configs.recommended],
		files: ['**/*.{ts,tsx}'],
		languageOptions: {
			ecmaVersion: 6,
			globals: globals.browser,
		},
		plugins: {
			'@stylistic': stylistic,
		},
		rules: {
			'array-bracket-spacing': 'warn',
			'arrow-spacing': 'warn',
			'block-spacing': 'warn',
			'brace-style': 'warn',
			'comma-dangle': ['warn', 'always-multiline'],
			'comma-spacing': 'warn',
			'computed-property-spacing': 'warn',
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/explicit-member-accessibility': 'off',
			'@typescript-eslint/explicit-module-boundary-types': 'off',
			'func-call-spacing': 'warn',
			'generator-star-spacing': ['warn', 'after'],
			'@stylistic/indent': ['warn', 'tab'],
			'@stylistic/eol-last': ['warn', 'always'],
			'jsx-a11y/alt-text': 'off',
			'jsx-a11y/anchor-is-valid': 'off',
			'key-spacing': 'warn',
			'keyword-spacing': 'warn',
			'@stylistic/member-delimiter-style': ['warn', { 'multiline': { 'delimiter': 'none' } }],
			'@typescript-eslint/member-ordering': 'off',
			'@typescript-eslint/no-empty-interface': 'off',
			'no-multi-spaces': 'warn',
			'@typescript-eslint/no-non-null-assertion': 'off',
			'@typescript-eslint/no-unused-vars': 'off',
			'@typescript-eslint/no-use-before-define': ['error', 'nofunc'],
			'@typescript-eslint/no-var-requires': 'off',
			'no-whitespace-before-property': 'warn',
			'object-curly-spacing': ['warn', 'always'],
			'rest-spread-spacing': 'warn',
			'@stylistic/semi': ['warn', 'never'],
			'semi-spacing': 'warn',
			'space-before-blocks': 'warn',
			'space-before-function-paren': ['warn', 'never'],
			'space-in-parens': 'warn',
			'space-infix-ops': 'warn',
			'space-unary-ops': 'warn',
			'switch-colon-spacing': 'warn',
			'template-curly-spacing': 'warn',
			'quotes': ['warn', 'single'],
			'yield-star-spacing': 'warn',
		},
	}
)
