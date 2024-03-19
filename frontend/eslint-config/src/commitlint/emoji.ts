import { common } from "./common"

export default {
	extends: ["gitmoji", "@commitlint/config-conventional"],
	...common,
	rules: {
		...common.rules,
		"type-empty": [0],
	},
}
