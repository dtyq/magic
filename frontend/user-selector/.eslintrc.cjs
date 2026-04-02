module.exports = {
	extends: [
		"@dtyq/eslint-config/base",
		"@dtyq/eslint-config/typescript",
		"@dtyq/eslint-config/react",
		"@dtyq/eslint-config/prettier",
		"plugin:tailwindcss/recommended",
	],
	parserOptions: {
		tsconfigRootDir: __dirname,
		project: ["./tsconfig.eslint.json"],
	},
	ignorePatterns: ["dist", "node_modules", "*.config.js", "*.config.cjs", "*.config.mjs"],
	settings: {
		react: {
			version: "detect",
		},
	},
	rules: {
		"tailwindcss/classnames-order": "warn",
		"tailwindcss/no-custom-classname": "off",
		"@typescript-eslint/no-empty-function": "off",
		"@typescript-eslint/no-explicit-any": "off",
		"@typescript-eslint/no-unused-vars": [
			"warn",
			{
				argsIgnorePattern: "^_",
				varsIgnorePattern: "^_",
			},
		],
		"react/prop-types": "off",
	},
}
