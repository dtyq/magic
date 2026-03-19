import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token }) => {
	return {
		container: {
			display: "flex",
			alignItems: "center",
			gap: "10px",
			padding: "6px",
			backgroundColor: "rgba(46, 47, 56, 0.05)",
			borderRadius: "100px",
			maxWidth: "400px",
			position: "relative",
		},

		taskInfo: {
			display: "flex",
			alignItems: "center",
			gap: "4px",
			flex: 1,
			width: "calc(100% - 60px)",
		},

		taskTitle: {
			fontSize: "14px",
			color: token.magicColorUsages.text[1],
			fontFamily: "PingFang SC",
			lineHeight: "20px",
			flex: 1,
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
		},
		taskListTitle: {
			whiteSpace: "pre-wrap",
		},

		progressInfo: {
			marginLeft: "auto",
			flexShrink: 0,
		},

		headerRight: {
			fontSize: "14px",
			color: token.colorTextSecondary,
			display: "flex",
			alignItems: "center",
			gap: 10,
		},
		header: {
			display: "flex",
			justifyContent: "space-between",
			alignItems: "center",
			cursor: "pointer",
			marginBottom: "0",
			borderRadius: token.borderRadiusSM,
			borderBottom: "none",
			borderRadiusBottom: "0",
		},
		headerExpanded: {
			padding: "10px 10px 5px 10px",
		},
		headerLeft: {
			display: "flex",
			alignItems: "center",
			gap: "8px",
		},
		headerLeftCollapsed: {
			width: "100%",
			overflow: "hidden",
			flex: 1,
			paddingLeft: "0",
		},
		progressWrapper: {
			width: "100%",
			display: "flex",
			alignItems: "center",
			gap: "8px",
		},
		progressText: {
			fontSize: "10px",
			fontWeight: 400,
			color: "rgba(28, 29, 35, 0.6)",
			lineHeight: "1.3",
			flexShrink: 0,
		},

		toggleButton: {
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			cursor: "pointer",
			padding: "2px",
		},

		chevronIcon: {
			color: "rgba(28, 29, 35, 0.6)",
			strokeWidth: 1.5,
		},

		"@keyframes pulse": {
			"0%": {
				opacity: 1,
			},
			"50%": {
				opacity: 0.5,
			},
			"100%": {
				opacity: 1,
			},
		},
		title: {
			fontSize: "14px",
			fontWeight: 600,
			color: "rgba(28, 29, 35, 0.8)",
			lineHeight: "1.3",
		},
		taskListWrapper: {
			position: "absolute",
			backgroundColor: "white",
			bottom: "33px",
			left: "10px",
			width: "calc(100% - 20px)",
			borderRadius: "8px 8px 0 0",
			border: `1px solid ${token.colorBorder}`,
			borderBottom: "none",
			zIndex: 22,
		},

		taskList: {
			display: "flex",
			flexDirection: "column",
			gap: 10,
			maxHeight: "240px",
			overflow: "auto",
			padding: 10,
			paddingTop: 5,
		},
		taskItem: {
			display: "flex",
			alignItems: "flex-start",
			gap: "4px",
			borderRadius: token.borderRadiusSM,
			lineHeight: "16px",
			// height: "32px",
			// background: token.colorBgElevated,
		},
		taskListItem: {
			textAlign: "start",
		},

		taskListContent: {
			padding: "20px 20px 100px 20px",
			display: "flex",
			flexDirection: "column",
			gap: "10px",
			".magic-divider-horizontal": {
				margin: 0,
			},
		},

		taskIconContainer: {
			flexShrink: 0,
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
		},

		taskContent: {
			flex: 1,
			display: "flex",
			flexDirection: "column",
			gap: "4px",
		},

		taskDescription: {
			fontSize: "12px",
			color: token.colorTextSecondary,
			lineHeight: "1.4",
		},

		progressTitleRight: {
			fontSize: "14px",
			color: token.magicColorUsages.text[1],
			lineHeight: "20px",
			fontWeight: 700,
		},
	}
})
