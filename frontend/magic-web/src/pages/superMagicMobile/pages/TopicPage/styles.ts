import { createStyles } from "antd-style"

export const useStyles = createStyles(() => {
	return {
		container: {
			display: "flex",
			flexDirection: "column",
			height: "100%",
		},
		body: {
			flex: 1,
			minHeight: 0,
			// Scroll lives on MessageList ScrollArea viewport; avoid nested scroll with edge-fade masks.
			overflow: "hidden",
			display: "flex",
			flexDirection: "column",
		},
		list: {},
		item: {},
		footer: {},
	}
})
