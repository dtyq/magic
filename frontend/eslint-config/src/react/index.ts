export default {
	globals: {
		React: true,
	},
	extends: ["plugin:react/recommended", "plugin:react-hooks/recommended"],
	rules: {
		"react/jsx-filename-extension": [
			"error",
			{
				extensions: [".ts", ".tsx", ".js", ".jsx"],
			},
		],
	},
}
