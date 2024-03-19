export default {
	env: {
		browser: true,
		node: true,
	},
	extends: ["eslint:recommended", "plugin:import/recommended"],
	ignorePatterns: [
		"!.prettierrc*",
		"!.stylelintrc*",
		"!.eslintrc*",
		"!*.ts",
		"!*.tsx",
		"!*.js",
		"!*.jsx",
		"!*.cjs",
		"!*.mjs",
	],
	rules: {
		"import/extensions": [
			"error",
			"ignorePackages",
			{
				js: "never",
				jsx: "never",
				ts: "never",
				tsx: "never",
				vue: "never",
			},
		],
		"no-case-declarations": "off",
	},
}
