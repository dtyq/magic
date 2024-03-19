const config = require("@dtyq/eslint-config/prettier/config")

module.exports = {
	...config,
	plugins: ["prettier-plugin-sort-json"],
	jsonRecursiveSort: true,
}
