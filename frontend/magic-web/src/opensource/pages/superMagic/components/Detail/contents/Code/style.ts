import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css }) => ({
	container: {
		width: "100%",
		height: "100%",
		overflowY: "auto",
		overflowX: "auto",

		"& pre[class*='language-']": {
			background: `${token.colorBgBase}!important`,
		},
	},
	editButton: css`
		height: 22px;
		font-size: 12px;
	`,
}))
