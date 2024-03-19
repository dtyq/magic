import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css }) => ({
	desc: css`
		color: ${token.magicColorUsages.text[3]};
		font-size: 12px;
	`,
	productName: {
		fontSize: 16,
		fontWeight: 500,
		color: token.magicColorUsages.text[0],
	},
	amount: {
		fontSize: 16,
		fontWeight: 600,
		color: token.colorPrimary,
	},
	time: {
		fontSize: 12,
		color: token.magicColorUsages.text[3],
	},
}))
