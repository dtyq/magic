export default {
	parser: "@typescript-eslint/parser",
	parserOptions: {
		project: ["tsconfig.json", "tsconfig.*json"],
		ecmaVersion: "latest",
		sourceType: "module",
	},
	plugins: ["@typescript-eslint"],
	extends: ["plugin:@typescript-eslint/recommended"],
	settings: {
		"import/resolver": {
			typescript: {
				alwaysTryTypes: true,
				project: ["tsconfig.json", "tsconfig.*json"],
			},
			node: {
				extensions: [".mjs", ".cjs", ".js", ".jsx", ".json", ".ts", ".tsx", ".d.ts"],
			},
		},
	},
	rules: {
		"@typescript-eslint/ban-ts-comment": "warn",
		"@typescript-eslint/no-empty-function": "warn",
		"@typescript-eslint/no-inferrable-types": "off",
		"@typescript-eslint/no-namespace": "off",
		"@typescript-eslint/no-empty-interface": "off",
	},
}
