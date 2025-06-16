module.exports = {
	root: true,
	extends: [
		"@dtyq/eslint-config",
		"@dtyq/eslint-config/typescript",
		"@dtyq/eslint-config/react",
		"@dtyq/eslint-config/prettier",
	],
	parserOptions: {
		project: ["./tsconfig.json", "./tsconfig.*.json"],
	},
	settings: {
		"import/resolver": {
			typescript: {
				project: ["./tsconfig.json", "./tsconfig.*json"],
			},
		},
	},
	rules: {
		"react/display-name": 0,
	},
	overrides: [
		{
			files: ["*.cjs"],
			rules: {
				"@typescript-eslint/no-var-requires": "off",
			},
		},
	],
}
