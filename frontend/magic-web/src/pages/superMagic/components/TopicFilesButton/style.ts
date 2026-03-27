import { createStyles, keyframes } from "antd-style"

const locateFileBlinkAnimation = keyframes`
	0%, 100% {
		background-color: transparent;
	}
	50% {
		background-color: #EEF3FD;
	}
`

export const useStyles = createStyles(({ token }) => ({
	container: {
		position: "static",
		height: "100%",
	},
	// Collapsed state button (contains icon + text)
	collapsedButton: {
		display: "flex",
		alignItems: "center",
		gap: "4px",
		padding: "6px 10px",
		backgroundColor: "#FFFFFF",
		borderRadius: "8px",
		border: "none",
		cursor: "pointer",
		fontSize: "14px",
		fontWeight: 400,
		color: "rgba(28, 29, 35, 0.8)",
		boxShadow: "0px 0px 1px 0px rgba(0, 0, 0, 0.3), 0px 4px 14px 0px rgba(0, 0, 0, 0.1)",
		transition: "all 0.3s ease",
		fontFamily: "PingFang SC, sans-serif",
		"&:hover": {
			transform: "translateY(-1px)",
			boxShadow: "0px 0px 1px 0px rgba(0, 0, 0, 0.3), 0px 6px 20px 0px rgba(0, 0, 0, 0.15)",
		},
	},
	// Expanded state panel
	expandedPanel: {
		height: "100%",
		backgroundColor: token.colorBgContainer,
		display: "flex",
		flexDirection: "column",
		animation: "expandPanel 0.2s ease-out",
		position: "relative",
	},
	actionButtons: {
		display: "flex",
		alignItems: "center",
		gap: "2px",
	},
	actionButton: {
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		width: "18px",
		height: "18px",
		backgroundColor: "transparent",
		border: "none",
		borderRadius: "4px",
		cursor: "pointer",
		transition: "background-color 0.2s ease",
		stroke: `${token.magicColorUsages.text[2]} !important`,
	},
	actionButtonText: {
		color: `${token.magicColorUsages.text[1]} !important`,
	},
	// 头部区域样式
	headerSection: {
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
		gap: "4px",
		padding: "8px 6px",
		borderBottom: `1px solid ${token.colorBorder}`,
		flexShrink: 0,
	},
	headerLeft: {
		display: "flex",
		alignItems: "center",
		gap: "4px",
	},
	// 选择模式头部样式
	selectModeHeader: {
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
		gap: "4px",
		padding: "8px 6px",
		borderBottom: `1px solid ${token.colorBorder}`,
		flexShrink: 0,
		userSelect: "none",
		width: "100%",
	},
	selectAllSection: {
		display: "flex",
		alignItems: "center",
		gap: "4px",
		cursor: "pointer",
	},
	selectAllText: {
		fontFamily: "PingFang SC",
		fontWeight: 400,
		fontSize: "12px",
		lineHeight: "1.33",
		color: token.magicColorUsages.text[1],
	},
	cancelSelectSection: {
		cursor: "pointer",
	},
	cancelSelectText: {
		fontFamily: "PingFang SC",
		fontWeight: 400,
		fontSize: "12px",
		lineHeight: "16px",
		color: "#000000",
	},
	activeButton: {
		backgroundColor: "rgba(49, 92, 236, 0.1)",
		"&:hover": {
			backgroundColor: "rgba(49, 92, 236, 0.15)",
		},
	},
	// Content area
	contentArea: {
		display: "flex",
		flexDirection: "column",
		gap: "6px",
		flex: 1,
		flexShrink: 1,
		minHeight: 0,
		"@media (max-width: 768px)": {
			marginTop: 6,
		},
	},
	// Search box
	searchBox: {
		padding: "6px 13px",
		fontSize: "14px",
		fontFamily: "PingFang SC, sans-serif",
		"&::placeholder": {
			color: "rgba(28, 29, 35, 0.35)",
		},
		width: "calc(100% - 12px)",
		height: 28,
		margin: "0px 6px",
		flexShrink: 0,
		borderRadius: "8px",
	},
	// File list area
	fileListArea: {
		overflow: "auto",
		border: "1px solid transparent",
		flex: 1,
		minHeight: 0,
		// 支持动态高度设置
		maxHeight: "100%",
		"&::-webkit-scrollbar": {
			width: "4px",
		},
		"&::-webkit-scrollbar-thumb": {
			backgroundColor: "rgba(0, 0, 0, 0.1)",
			borderRadius: "2px",
		},
		"&::-webkit-scrollbar-track": {
			backgroundColor: "transparent",
		},
		".magic-tree": {
			padding: 0,
			overflow: "visible",
		},
		".magic-tree-switcher": {
			display: "none",
		},
		".magic-tree-treenode": {
			"&:hover": {
				backgroundColor: token.magicColorUsages.fill[0],
				borderRadius: "8px",
			},
			"&::before": {
				display: "none",
			},
		},
		".magic-tree-indent": {
			flex: "0 0 10px !important",
			display: "none",
		},
		".dragging": {
			backgroundColor: "#f0f6ff",
		},
		".magic-tree-node-content-wrapper ": {
			padding: 0,
			flex: 1,
			flexShrink: 1,
			minWidth: 0,
		},
	},
	// 拖拽悬停样式
	dragOverArea: {
		backgroundColor: "rgba(24, 144, 255, 0.06)",
		border: "2px dashed rgba(24, 144, 255, 0.4)",
		borderRadius: "6px",
		transition: "all 0.2s ease",
	},
	// Use WorkSpacePanel file item styles
	fileItem: {
		fontSize: 12,
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		padding: "7px 8px 7px 4px",
		borderRadius: "6px",
		cursor: "pointer",
		userSelect: "none",
		position: "relative",
		"@media (max-width: 768px)": {
			height: 40,
			fontSize: 14,
		},
	},
	// 插入指示器
	insertIndicator: {
		position: "absolute",
		left: 0,
		right: 0,
		height: "2px",
		backgroundColor: token.colorPrimary,
		borderRadius: "1px",
		zIndex: 10,
		"&.before": {
			top: "-1px",
		},
		"&.after": {
			bottom: "-1px",
		},
	},
	// 拖拽手柄
	dragHandle: {
		cursor: "grab",
		transition: "all 0.2s ease",
		color: token.colorTextTertiary,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		width: "20px",
		height: "20px",
		borderRadius: "4px",
		backgroundColor: token.colorFillQuaternary,
		border: `1px solid ${token.colorBorderSecondary}`,
		"&:hover": {
			opacity: 1,
			backgroundColor: token.colorFillTertiary,
			color: token.colorTextSecondary,
			transform: "scale(1.1)",
		},
		"&:active": {
			cursor: "grabbing",
			backgroundColor: token.colorPrimary,
			color: token.colorWhite,
		},
	},
	// 拖拽预览样式
	dragPreview: {
		backgroundColor: token.colorBgContainer,
		border: `1px solid ${token.colorBorder}`,
		borderRadius: "6px",
		padding: "4px 8px",
		boxShadow: token.boxShadowSecondary,
		display: "flex",
		alignItems: "center",
		gap: "4px",
		fontSize: "12px",
		color: token.colorTextSecondary,
		maxWidth: "200px",
		opacity: 0.9,
	},
	// Active file item styles
	activeFileItem: {
		color: `${token.colorPrimary} !important`,
		fontWeight: 500,
	},
	// Context menu active item styles (simulates hover state)
	contextMenuActiveItem: {
		backgroundColor: `${token.magicColorUsages.fill[0]} !important`,
		borderRadius: "8px",
	},
	// Opened file item styles (files that are open in tabs)
	openedFileItem: {
		color: `${token.colorPrimary} !important`,
		fontWeight: 500,
	},
	// Locating file item styles (with blinking animation)
	locatingFileItem: {
		animation: `${locateFileBlinkAnimation} 1s ease-in-out 2`,
		borderRadius: "8px",
	},
	// Folder container styles
	folderContainer: {
		position: "relative",
	},
	iconWrapper: {
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		width: "16px",
		height: "16px",
		flexShrink: 0,
		svg: {
			background: "transparent",
		},
	},
	spin: {
		marginRight: "0 !important",
		".magic-spin-dot": {
			width: "12px !important",
			height: "12px !important",
		},
	},
	iconButton: {
		width: "14px !important",
		height: "14px !important",
		minWidth: "14px !important",
		padding: "0 !important",
		border: "none",
	},
	errorMessage: {
		position: "absolute",
		top: "23px",
		fontSize: "12px",
		zIndex: 1000,
		"& .magic-alert-message": {
			fontSize: "12px",
		},
	},
	// Use WorkSpacePanel file title styles
	fileTitle: {
		display: "flex",
		alignItems: "center",
		flex: 1,
		minWidth: 0,
		color: token.colorTextSecondary,
		".anticon": {
			fontSize: "14px",
		},
		gap: 6,
	},
	rowTitleText: {
		display: "flex",
		alignItems: "center",
		flex: 1,
		minWidth: 0,
	},
	rowTagSlot: {
		display: "flex",
		alignItems: "center",
		flexShrink: 0,
		marginLeft: "auto",
		marginRight: "4px",
	},
	activeFileItemWrapper: {
		// backgroundColor: "#EEF3FD",
	},
	fileName: {
		fontSize: "14px",
		fontFamily: "PingFang SC, sans-serif",
		color: token.colorTextSecondary,
		flex: 1,
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
	},
	// Use WorkSpacePanel ellipsis styles
	ellipsis: {
		fontSize: "14px",
		lineHeight: "16px",
		color: token.magicColorUsages.text[1],
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
		cursor: "pointer",
		"&:hover": {
			color: token.colorPrimary,
		},
	},
	// 重命名输入框样式
	renameInput: {
		height: "20px !important",
		fontSize: "12px",
		flex: 1,
		"& .ant-input": {
			height: "20px",
			fontSize: "12px",
			padding: "0 4px",
		},
	},
	actionDots: {
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		width: "18px",
		height: "18px",
		opacity: 0,
		transition: "opacity 0.2s ease",
		"$fileItem:hover &": {
			opacity: 1,
		},
	},
	// Use WorkSpacePanel attachment action styles
	attachmentAction: {
		color: "#747f8d",
		fontSize: "16px",
		"&:hover": {
			color: "rgba(28, 29, 35, 0.8)",
			backgroundColor: token.magicColorUsages.fill[0],
			borderRadius: "4px",
		},
	},
	emptyState: {
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		height: "100%",
		color: token.colorTextQuaternary,
		fontSize: "14px",
	},
	// Filter dropdown styles
	filterPopover: {
		"& .ant-popover-inner": {
			borderRadius: "8px",
			boxShadow: "0px 0px 1px 0px rgba(0, 0, 0, 0.3), 0px 4px 14px 0px rgba(0, 0, 0, 0.1)",
		},
		"& .ant-popover-inner-content": {
			padding: "10px",
		},
	},
	filterOption: {
		display: "flex",
		alignItems: "center",
		gap: "8px",
		padding: "4px 0",
		"& .ant-checkbox-wrapper": {
			fontFamily: "PingFang SC, sans-serif",
			fontSize: "14px",
			color: "rgba(28, 29, 35, 0.6)",
		},
	},
	// Batch download layer
	batchDownloadLayer: {
		gap: "8px",
		backgroundColor: "#FFFFFF",
		borderTop: "1px solid rgba(28, 29, 35, 0.08)",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		animation: "slideUp 0.2s ease-out",
		height: 40,
		flexShrink: 0,
		"@media (max-width: 768px)": {
			height: 50,
			"&:hover": {
				background: "none",
			},
		},
		"&:empty": {
			display: "none",
		},
	},
	batchOperations: {
		display: "flex",
		alignItems: "center",
		gap: "6px",
		width: "calc(100% - 12px)",
	},
	batchMoveButton: {
		height: 28,
		flex: 1,
		minWidth: 0,
		flexShrink: 1,
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
		color: `${token.colorPrimary} !important`,
		borderColor: `${token.colorPrimary} !important`,
		fontSize: "12px",
		lineHeight: "16px",
		"&:hover": {
			color: `${token.colorPrimary} !important`,
		},
	},
	batchDeleteButton: {
		height: 28,
		flex: 1,
		minWidth: 0,
		flexShrink: 1,
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
		fontSize: "12px",
		lineHeight: "16px",
	},
	hidden: {
		display: "none",
	},
	pcBatchDownloadLayer: {
		backgroundColor: "transparent",
	},
	batchDownloadSeparator: {
		width: "1px",
		height: "100%",
		backgroundColor: token.colorBorder,
	},
	batchDownloadButtonPC: {
		height: 28,
		flex: "0 0 128px",
		fontSize: "12px",
	},
	batchDownloadButtonPCText: {},
	batchDropdownMenu: {},
	batchDownloadButton: {
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		gap: "4px",
		backgroundColor: "transparent",
		border: "none",
		fontSize: "14px",
		fontFamily: "PingFang SC, sans-serif",
		color: "rgba(28, 29, 35, 0.8)",
		cursor: "pointer",
		borderRadius: "6px",
		transition: "background-color 0.2s ease",
		flex: 1,
		height: 20,
		"&:disabled": {
			opacity: 1,
		},
	},
	"@keyframes expandPanel": {
		from: {
			opacity: 0,
			transform: "scale(0.95)",
		},
		to: {
			opacity: 1,
			transform: "scale(1)",
		},
	},
	"@keyframes slideUp": {
		from: {
			transform: "translateY(100%)",
		},
		to: {
			transform: "translateY(0)",
		},
	},
	danger: {
		stroke: token.colorError,
	},
	popconfirm: {
		"& .magic-popconfirm-message-icon": {
			svg: {
				marginTop: 3,
			},
		},
		"& .magic-popconfirm-message-text": {
			marginLeft: 4,
		},
	},
	// 拖拽移动样式
	dragTargetFolder: {
		borderRadius: "8px !important",
		border: "1px solid #a9bff7 !important",
		background: "#eef3fd !important",
		position: "relative",
		zIndex: 1,
		transition: "all 0.2s ease",

		// 确保展开的文件夹及其子项都被高亮
		"&.expanded": {
			"& .file-item": {
				background: "#eef3fd",
			},
		},
	},
	draggingItem: {
		opacity: 0.5,
		transform: "scale(0.95)",
		transition: "all 0.2s ease",
		pointerEvents: "none",
		// 拖拽状态样式
		zIndex: 1000,
	},
	// 快捷键显示样式
	menuItemShortcut: {
		display: "inline-flex",
		gap: "4px",
		alignItems: "center",
		marginLeft: "8px",
	},
	menuItemShortcutItem: {
		display: "inline-flex",
		flexDirection: "column",
		alignItems: "center",
		justifyContent: "center",
		width: "20px",
		height: "20px",
		color: "rgba(107, 114, 128, 1)",
		background: "rgba(245, 245, 245, 1)",
		borderRadius: "4px",
		fontSize: "12px",
	},
}))
