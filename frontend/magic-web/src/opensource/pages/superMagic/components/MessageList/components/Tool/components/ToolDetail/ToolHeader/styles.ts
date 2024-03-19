import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token }) => ({
	commonHeader: {
		position: "relative",
		height: "44px",
		flex: "none",
		borderBottom: `1px solid ${token.colorBorderSecondary}`,
		backgroundColor: "white",
		padding: "10px",
		fontSize: 14,
		gap: 4,
		fontWeight: 400,
		lineHeight: "20px",
		color: token.colorTextSecondary,
		width: "100%",
		borderRadius: "8px 8px 0 0",
	},
	titleContainer: {
		flex: 1,
		maxWidth: "100%",
	},
	icon: {
		flex: "none",
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		flexShrink: 0,
	},
	title: {
		textOverflow: "ellipsis",
		overflow: "hidden",
		whiteSpace: "nowrap",
		flexShrink: 0,
	},
}))
