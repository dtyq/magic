module.exports = {
	root: true,
	extends: [
		"@dtyq/eslint-config/base",
		"@dtyq/eslint-config/typescript",
		"@dtyq/eslint-config/react",
		"@dtyq/eslint-config/prettier",
	],
	plugins: ["tailwindcss", "local"],
	parserOptions: {
		project: ["./tsconfig.eslint.json"],
		tsconfigRootDir: __dirname,
	},
	settings: {
		"import/resolver": {
			typescript: {
				project: ["./tsconfig.json", "./tsconfig.eslint.json", "./tsconfig.test.json"],
			},
		},
		react: {
			version: "detect",
		},
		tailwindcss: {
			config: "./tailwind.config.js",
			callees: ["cn", "clsx", "cva"],
		},
	},
	rules: {
		"react/display-name": 0,
		"react/prop-types": 0,
		"tailwindcss/classnames-order": "warn",
		"local/no-component-recursion": "warn",
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
