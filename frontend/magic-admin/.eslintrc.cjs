module.exports = {
	globals: {
		React: true,
	},
	env: {
		browser: true,
		es2020: true,
		node: true,
	},
	extends: [
		"@dtyq/eslint-config/base",
		"@dtyq/eslint-config/typescript",
		"@dtyq/eslint-config/react",
		"@dtyq/eslint-config/prettier",
	],
	// parser: "@typescript-eslint/parser",
	parserOptions: {
		project: ["./tsconfig.json", "./tsconfig.app.json", "./tsconfig.node.json"],
	},
	settings: {
		react: {
			version: "detect",
		},
	},
	rules: {
		"react/display-name": 0,
		"@typescript-eslint/no-unused-vars": "off",
		"@typescript-eslint/no-explicit-any": "off",
	},
	ignorePatterns: ["node_modules", "dist", "build", "public", "*.cjs"],
}
