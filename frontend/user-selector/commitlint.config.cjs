const config = require("@dtyq/eslint-config/commitlint/emoji")

module.exports = {
	...config,
	rules: {
		...config.rules,
		"header-max-length": [1, "always", 72], // 1 表示警告级别，0=禁用，1=警告，2=错误
	},
}
