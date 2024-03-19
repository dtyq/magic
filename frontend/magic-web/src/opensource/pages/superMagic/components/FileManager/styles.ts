import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token }) => ({
	container: {
		height: "100%",
		padding: 6,
		background: token.colorBgLayout,
		display: "flex",
		flexDirection: "column",
	},
	tabsList: {
		display: "flex",
		gap: 6,
		padding: 0,
		margin: 0,
	},
	tabItem: {
		height: 52,
		padding: "0 20px 0 10px",
		cursor: "pointer",
		borderRadius: "8px 8px 0 0",
		background: "transparent",
		borderStyle: "solid",
		borderWidth: 1,
		borderColor: "transparent",
		borderBottom: "none",
	},
	tabItemActive: {
		background: "white",
		borderColor: token.magicColorUsages.border,
		position: "relative",
		"&::after": {
			content: '""',
			position: "absolute",
			bottom: -2,
			left: 0,
			right: 0,
			height: 2,
			background: "white",
		},
	},
	tabIcon: {
		width: 32,
		height: 32,
		marginRight: 6,
	},
	tabContent: {
		flex: 1,
		border: "1px solid #f0f0f0",
		backgroundColor: "white",
		borderRadius: 8,
		overflow: "hidden",
	},
	tabContentActiveFirstTab: {
		borderTopLeftRadius: 0,
	},
	// 以下为页面公共样式
	pageContainer: {
		display: "flex",
		flexDirection: "column",
		height: "100%",
		overflow: "hidden",
	},
	title: {
		fontSize: 16,
		fontWeight: 600,
		padding: "20px 20px 0 20px",
	},
	description: {
		fontSize: 12,
		fontWeight: 400,
		marginTop: 10,
		color: token.magicColorUsages.text[2],
		padding: "0 20px",
	},
	formHeader: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		marginTop: 10,
		padding: "0 20px",
	},
	searchInput: {
		width: 240,
	},
	emptyWrapper: {
		width: "100%",
		height: "100%",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
	},
	loadingWrapper: {
		width: "100%",
		height: "100%",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
	},
	pageContent: {
		marginTop: 10,
		flex: "auto",
		overflow: "hidden",
		position: "relative",
		padding: "0 20px 20px 20px",
	},
}))
