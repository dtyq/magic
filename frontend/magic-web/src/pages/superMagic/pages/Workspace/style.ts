import { createStyles } from "antd-style"

const useStyles = createStyles(({ token, css }) => ({
	container: {
		display: "flex",
		height: "100%",
		overflow: "hidden",
		position: "relative",
	},

	workspaceList: {
		userSelect: "none",
		height: "100%",
		display: "flex",
		overflowX: "auto",
		alignItems: "center",
		whiteSpace: "nowrap",
		"&::-webkit-scrollbar": {
			height: "4px",
		},
		"&::-webkit-scrollbar-thumb": {
			backgroundColor: token.colorBorderSecondary,
		},
		gap: "6px",
		padding: "6px",
	},
	workspaceTab: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		padding: "0 16px",
		cursor: "pointer",
		transition: "background-color 0.2s",
		height: "100%",
		minWidth: "140px",
		maxWidth: "250px",
		fontFamily: "PingFang SC",
		fontWeight: 400,
		fontSize: "14px",
		lineHeight: "20px",
		letterSpacing: "0px",
		color: "rgba(0, 0, 0, 0.65)",
		borderRadius: "8px",
		"&:hover": {
			backgroundColor: token.colorFillSecondary,
		},
		"& .workspace-content": {
			display: "flex",
			alignItems: "center",
			gap: "8px",
			flex: "1 1 auto",
			minWidth: 0,
		},
		"& .workspace-dot": {
			width: "8px",
			height: "8px",
			borderRadius: "50%",
			flexShrink: 0,
		},
		"& .workspace-name": {
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
			maxWidth: "100px",
		},
	},
	workspaceTabSelected: {
		minWidth: "140px",
		maxWidth: "250px",
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		padding: "0 16px",
		cursor: "pointer",
		height: "100%",
		position: "relative",
		backgroundColor: "#f0f6ff",
		fontFamily: "PingFang SC",
		fontSize: "14px",
		lineHeight: "20px",
		letterSpacing: "0px",
		color: "rgba(0, 0, 0, 0.88)",
		borderRadius: "10px",

		// "&::after": {
		// 	content: '""',
		// 	position: "absolute",
		// 	bottom: 0,
		// 	left: 0,
		// 	right: 0,
		// 	height: "2px",
		// 	backgroundColor: token.colorPrimary,
		// 	zIndex: 1,
		// },
		"& .workspace-content": {
			display: "flex",
			alignItems: "center",
			gap: "8px",
			flex: "1 1 auto",
			minWidth: 0,
		},
		"& .workspace-dot": {
			width: "8px",
			height: "8px",
			borderRadius: "50%",
			flexShrink: 0,
		},
		"& .workspace-name": {
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
			maxWidth: "100px",
		},
	},
	addWorkspaceButton: {
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		height: "100%",
		width: "40px",
		color: token.colorTextSecondary,
		"&:hover": {
			color: token.colorPrimary,
			backgroundColor: token.colorFillSecondary,
		},
	},
	inlineInput: {
		margin: "0 4px",
		width: "120px",
	},
	mainContent: {
		display: "flex",
		flex: 1,
		paddingTop: "0px",
		overflow: "hidden",
		position: "relative",
	},
	singleModeMainContent: {
		padding: 0,
	},
	emptyTopicFilesWrapper: {
		width: "auto",
		display: "flex",
	},
	topicFilesWrapper: {
		display: "flex",
		position: "relative",
	},
	singleMode: {
		padding: 0,
	},
	readOnlyMode: {
		width: "100%",
	},
	workspacePanel: {
		width: "250px",
		minWidth: "250px",
	},
	messagePanelWrapper: {
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		// borderLeft: "1px solid rgba(28, 29, 35, 0.08)",
		overflow: "hidden",
		position: "relative",
		zIndex: 10,
	},
	chatMessagePanelWrapper: {
		borderLeft: "1px solid rgba(28, 29, 35, 0.08)",
	},
	messagePanelDragging: {
		borderLeftColor: token.magicColorUsages.primary.default,
		userSelect: "none",
	},
	singleModeMessagePanelWrapper: {
		marginLeft: 0,
	},
	emptyMessagePanel: {
		width: "100%",
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		justifyContent: "center",
		paddingBottom: "0",
	},
	messagePanel: {
		borderRadius: "8px",
	},
	emptyMessageWelcome: css`
		height: auto;
		flex: none;

		div {
			padding: 0;

			& > div:first-child {
				font-size: 36px;
				width: auto;
				height: auto;
				margin-bottom: 10px;
			}
		}
	`,
	emptyMessageInput: {
		maxWidth: "800px",
		alignSelf: "center",
		padding: "0px 50px",
		marginTop: "30px",
	},
	emptyMessageTextAreaWrapper: {
		height: "100px",
	},
	detailPanel: {
		minWidth: "400px",
		flex: 1,
		// paddingBottom: "70px",
		overflow: "hidden",
		backgroundColor: "transparent",
	},
	singleModeDetailPanel: {
		borderRadius: 0,
		marginLeft: 0,
	},
}))

export default useStyles
