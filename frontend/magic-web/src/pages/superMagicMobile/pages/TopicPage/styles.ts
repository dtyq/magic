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
		},
		list: {},
		item: {},
		footer: {
			paddingBottom: "4px",
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
