import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token }) => ({
	header: {
		padding: "10px",
		flex: "none",
		backgroundColor: token.magicColorUsages.fill[0],
	},
	url: {
		backgroundColor: token.colorBorderSecondary,
		borderRadius: 1000,
		padding: "0 10px",
		fontSize: 14,
		color: token.magicColorUsages.text[2],
		height: 32,
		display: "flex",
		alignItems: "center",
	},
	text: {
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
		marginLeft: 4,
	},
	icon: {
		flex: "0 0 20px",
	},
}))
