const { srcImportBoundaryOverride } = require("./eslint/src-import-boundary.cjs")

module.exports = {
	root: true,
	ignorePatterns: ["src/pages/superMagic/components/Detail/contents/HTML/templates/**"],
	extends: [
		"@dtyq/eslint-config/base",
		"@dtyq/eslint-config/typescript",
		"@dtyq/eslint-config/react",
		"@dtyq/eslint-config/prettier",
	],
	plugins: ["tailwindcss", "local", "compat"],
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
		polyfills: [
			"Array.prototype.at",
			"Array.prototype.findLast",
			"Array.prototype.findLastIndex",
			"String.prototype.at",
			"String.prototype.replaceAll",
			"Object.hasOwn",
			"Promise.withResolvers",
			"window.requestIdleCallback",
			"window.cancelIdleCallback",
		],
	},
	rules: {
		"react/display-name": 0,
		"react/prop-types": 0,
		"tailwindcss/classnames-order": "warn",
		"local/no-component-recursion": "warn",
		"compat/compat": "warn",
		"no-restricted-syntax": [
			"error",
			{
				selector: "MemberExpression[property.name='toSorted']",
				message:
					"Array.prototype.toSorted() is not supported in Chrome < 110 / Safari < 16. Use [...arr].sort() or .slice().sort() instead.",
			},
			{
				selector: "MemberExpression[property.name='toReversed']",
				message:
					"Array.prototype.toReversed() is not supported in Chrome < 110 / Safari < 16. Use [...arr].reverse() or .slice().reverse() instead.",
			},
			{
				selector: "MemberExpression[property.name='toSpliced']",
				message:
					"Array.prototype.toSpliced() is not supported in Chrome < 110 / Safari < 16. Use .slice() + .splice() instead.",
			},
			{
				selector:
					"MemberExpression[property.name='with'][parent.type='CallExpression'][parent.arguments.length>=2]",
				message:
					"Array.prototype.with() is not supported in Chrome < 110 / Safari < 16. Use arr.slice() and index assignment instead.",
			},
			{
				selector: "MemberExpression[object.name='Object'][property.name='groupBy']",
				message:
					"Object.groupBy() is not supported in Chrome < 117 / Safari < 17.4. Use lodash-es groupBy or a manual reduce instead.",
			},
			{
				selector: "MemberExpression[object.name='Map'][property.name='groupBy']",
				message:
					"Map.groupBy() is not supported in Chrome < 117 / Safari < 17.4. Use a manual reduce instead.",
			},
			{
				selector: "CallExpression[callee.name='structuredClone']",
				message:
					"structuredClone() is not supported in Chrome < 98 / Safari < 15.4. Use JSON.parse(JSON.stringify()) or lodash-es cloneDeep instead.",
			},
		],
	},
	overrides: [
		srcImportBoundaryOverride,
		{
			files: ["*.cjs"],
			rules: {
				"@typescript-eslint/no-var-requires": "off",
			},
		},
	],
}
