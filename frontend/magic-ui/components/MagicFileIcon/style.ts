import { createStyles } from "antd-style"

export const useStyles = createStyles(() => ({
	fileIcon: {
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
	},
	image: {
		width: "100%",
		height: "100%",
		objectFit: "contain",
		objectPosition: "center",
	},
}))
