import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, prefixCls }) => ({
	container: {
		height: "100%",
		display: "flex",
		flexDirection: "column",
		backgroundColor: token.magicColorUsages.bg[0],
	},
	filterBar: {
		padding: "12px",
		backgroundColor: token.magicColorUsages.bg[0],
		borderBottom: `1px solid ${token.magicColorUsages.border}`,
		flexShrink: 0,
	},
	totalText: {
		fontSize: 14,
		fontWeight: 500,
		color: token.magicColorUsages.text[0],
	},
	list: {
		[`& .${prefixCls}-list-items`]: {
			display: "flex",
			flexDirection: "column",
			gap: 12,
		},
	},
	scrollContainer: {
		flex: 1,
		padding: "12px 12px 0 12px",
		overflowY: "auto",
		overflowX: "hidden",
		"-webkit-overflow-scrolling": "touch",
	},
	pagination: {
		padding: "12px 0",
		position: "sticky",
		bottom: 0,
		display: "flex",
		justifyContent: "center",
		backgroundColor: token.magicColorUsages.bg[0],
	},
}))
