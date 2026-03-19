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
			overflowY: "auto",
			overflowX: "hidden",
			display: "flex",
			flexDirection: "column",
			backgroundColor: "white",
		},
		list: {},
		item: {},
		footer: {
			backgroundColor: "white",
			paddingBottom: "max(var(--safe-area-inset-bottom), 10px)",
		},
		emptyMessageWelcome: {
			height: "auto",
			flex: "none",
			"& > div": {
				padding: 0,
				"& > div:first-child": {
					fontSize: "36px",
					width: "auto",
					height: "auto",
					marginBottom: "10px",
				},
			},
		},
	}
})
