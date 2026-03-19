import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token }) => ({
	container: {
		width: 600,
		boxShadow: token.boxShadowSecondary,
		borderRadius: 8,
		overflow: "hidden",

		// 移除原有的 position, top, right, zIndex，这些由 useDraggable 处理
	},

	// 拖拽状态样式
	dragging: {
		transform: "rotate(2deg)",
		transition: "none",
	},

	header: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		padding: "8px 16px",
		background: token.colorBgContainer,
		borderBottom: `1px solid ${token.colorBorderSecondary}`,
		transition: "all 0.2s ease",
		gap: 8,
		cursor: "grab",
		height: 52,
	},

	headerTitle: {
		display: "flex",
		alignItems: "center",
		gap: 10,
		fontSize: 16,
		color: token.magicColorUsages.text[1],
		lineHeight: "22px",
	},

	headerActions: {
		display: "flex",
		alignItems: "center",
		gap: 10,

		".magic-btn-icon": {
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			color: token.magicColorUsages.text[1],
		},
	},

	tasksContainer: {
		background: token.colorBgContainer,
		borderRadius: "0 0 8px 8px",
		maxHeight: 400,
		overflowY: "auto",
		border: `1px solid ${token.colorBorderSecondary}`,
		borderTop: "none",
	},

	tasksContainerWithoutSummary: {},

	collapsed: {
		borderRadius: 8,
	},

	// 支持英文较长文本的布局
	englishLayout: {
		minWidth: 420,
		maxWidth: 500,
	},

	noTasks: {
		padding: "20px 16px",
		textAlign: "center",
		color: token.colorTextSecondary,
		fontSize: 13,
	},

	progressText: {
		fontSize: 12,
		color: token.colorTextSecondary,
	},

	progressCount: {
		color: token.magicColorUsages.text[1],
		fontSize: 16,
		fontWeight: 400,
		lineHeight: "22px",
	},

	viewFailedFilesButton: {
		color: token.magicColorUsages.text[1],
		fontSize: 12,
		fontWeight: 400,
		lineHeight: "16px",
		padding: "4px 8px",
		borderRadius: 8,
		background: token.magicColorUsages.fill[1],
		cursor: "pointer",
		"&:hover": {
			background: token.magicColorUsages.fill[2],
		},
	},

	backButton: {
		display: "flex",
		alignItems: "center",
		gap: 0,
		padding: 0,
		paddingRight: 4,
		color: token.colorText,
		borderRadius: token.borderRadius,
		fontSize: 12,
		lineHeight: "16px",
		background: token.magicColorUsages.fill[0],
		"&:hover": {
			background: token.magicColorUsages.fill[1],
			color: token.colorPrimary,
		},
		".magic-btn-icon": {
			display: "flex",
			alignItems: "center",
		},
	},

	completedToggle: {
		padding: "8px 16px",
		borderBottom: `1px solid ${token.colorBorderSecondary}`,
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
		background: token.colorBgLayout,
	},

	toggleText: {
		fontSize: 12,
		color: token.colorTextSecondary,
	},

	toggleButton: {
		fontSize: 11,
		height: "auto",
		padding: "2px 8px",
	},

	// 关闭按钮样式
	closeButton: {
		color: token.colorTextTertiary,

		"&:hover": {
			color: token.colorError,
			background: token.colorErrorBg,
		},
	},
}))
