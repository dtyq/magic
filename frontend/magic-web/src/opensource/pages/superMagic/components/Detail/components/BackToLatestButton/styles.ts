import { createStyles } from "antd-style"

export const useStyles = createStyles(() => ({
	container: {
		position: "absolute",
		bottom: "20px",
		left: "50%",
		transform: "translateX(-50%)",
		zIndex: 100,
		cursor: "pointer",
	},
	button: {
		backgroundColor: "#FFFFFF",
		boxShadow: "0px 0px 1px 0px rgba(0, 0, 0, 0.3), 0px 4px 14px 0px rgba(0, 0, 0, 0.1)",
		borderRadius: "12px",
		padding: "4px",
		display: "flex",
		justifyContent: "center",
		alignItems: "center",
		transition: "all 0.2s ease",
		"&:hover": {
			boxShadow: "0px 0px 1px 0px rgba(0, 0, 0, 0.4), 0px 6px 20px 0px rgba(0, 0, 0, 0.15)",
		},
	},
	iconContainer: {
		borderRadius: "8px",
		padding: "4px 8px",
		display: "flex",
		alignItems: "center",
		gap: "2px",
		transition: "background-color 0.2s ease",
		"&:hover": {
			backgroundColor: "rgba(46, 47, 56, 0.08)",
		},
	},
	text: {
		fontSize: "12px",
		lineHeight: "14px",
		color: "rgba(28, 29, 35, 0.8)",
		fontFamily: "PingFang SC",
		fontWeight: 400,
	},
}))
