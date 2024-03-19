import { createStyles } from "antd-style"

export const useStyles = createStyles(() => ({
	browserContainer: {
		display: "flex",
		flexDirection: "column",
		height: "100%",
	},
	content: {
		flex: "auto",
		overflow: "hidden auto",
	},
	screenshot: {
		width: "100%",
	},
}))
