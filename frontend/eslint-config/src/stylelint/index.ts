export default {
	customSyntax: "postcss",
	extends: [
		"stylelint-config-standard",
		"stylelint-config-rational-order",
		"stylelint-prettier/recommended",
	],
	overrides: [
		{
			files: ["*.vue"],
			customSyntax: "postcss-html",
		},
		{
			files: ["*.less"],
			customSyntax: "postcss-less",
			extends: ["stylelint-config-recommended-less"],
		},
	],
	rules: {
		"selector-pseudo-class-no-unknown": null,
		"selector-class-pattern": null,
		"block-no-empty": null,
		"keyframes-name-pattern": null,
		"number-max-precision": null,
	},
}
