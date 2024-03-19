import { createStyles } from "antd-style"

export const useStyles = createStyles(() => {
	return {
		emptyContainer: {
			display: "flex",
			flexDirection: "column",
			alignItems: "center",
			justifyContent: "center",
			height: "100%",
			padding: "20px",
		},
		emptyIcon: {
			width: "120px",
			height: "120px",
			marginBottom: "24px",
			fontSize: "80px",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
		},
		emptyTitle: {
			fontSize: "24px",
			fontWeight: "bold",
			color: "#313338",
			marginBottom: "8px",
		},
		emptyText: {
			fontSize: "16px",
			color: "#747f8d",
			textAlign: "center",
			maxWidth: "360px",
		},
	}
})
