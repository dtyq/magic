import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token }) => {
	return {
		actionButton: {
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			cursor: "pointer",
			borderRadius: 8,
			"&:hover": {
				backgroundColor: "#2E2F380D",
			},
			"&:active": {
				backgroundColor: "#2E2F381A",
			},
		},
	}
})
