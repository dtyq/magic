module.exports = {
	extends: ["@dtyq/eslint-config/stylelint"],
	rules: {
		"at-rule-no-unknown": [
			true,
			{
				ignoreAtRules: ["tailwind", "apply", "layer", "config"],
			},
		],
	},
}
