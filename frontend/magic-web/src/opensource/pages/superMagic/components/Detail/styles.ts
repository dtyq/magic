import { createStyles, keyframes } from "antd-style"

// 定义闪烁动画
const shimmerAnimation = keyframes`
	0% {
		background-position: 200% 0;
	}
	100% {
		background-position: -200% 0;
	}
`

// Define the styles using createStyles
export const useStyles = createStyles(({ token }) => {
	return {
		hasDetailContainer: {
			background: token.colorBgContainer,
		},
		emptyDetailContainer: {
			height: 0,
			padding: 0,
		},
		detailContainerSingle: {
			padding: "14px",
		},
		detailContainerShare: {
			padding: "0",
		},
		renderContainer: {
			height: "100%",
			overflow: "hidden",
			position: "relative",
			borderRadius: "8px 8px 0 0",
			border: `1px solid ${token.colorBorder}`,
		},
		renderContainerShare: {
			borderRadius: "8px",
		},
		renderContainerShareFile: {
			border: "none",
		},
		renderContainerRunning: {
			position: "relative",
			"&::after": {
				content: '""',
				position: "absolute",
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				pointerEvents: "none",
				willChange: "box-shadow",
				animation: "breathingLight 5s ease-in-out infinite",
				zIndex: 0,
			},
			"@keyframes gradientMove": {
				"0%": {
					backgroundPosition: "0% 50%",
				},
				"50%": {
					backgroundPosition: "100% 50%",
				},
				"100%": {
					backgroundPosition: "0% 50%",
				},
			},
			"@keyframes breathingLight": {
				"0%": {
					boxShadow:
						"10px 10px 20px 0px rgba(238, 0, 255, 0.05) inset, -10px -10px 20px 0px rgba(95, 254, 250, 0.15) inset",
				},

				"50%": {
					boxShadow:
						"10px 10px 150px 0px rgba(238, 0, 255, 0.50) inset, -10px -10px 150px 0px rgb(0, 255, 255) inset",
				},

				"100%": {
					boxShadow:
						"10px 10px 20px 0px rgba(238, 0, 255, 0.05) inset, -10px -10px 20px 0px rgba(95, 254, 250, 0.15) inset",
				},
			},
			/* 暗黑模式下的呼吸灯效果 */
			"@keyframes breathingLightDark": {
				"0%": {
					boxShadow:
						"10px 10px 20px 0px rgba(98, 0, 255, 0.01) inset, -10px -10px 20px 0px rgba(0, 255, 25, 0.01) inset",
				},

				"50%": {
					boxShadow:
						"10px 10px 150px 0px rgb(98, 0, 255) inset, -10px -10px 150px 0px rgb(0, 255, 251) inset",
				},

				"100%": {
					boxShadow:
						"10px 10px 20px 0px rgba(98, 0, 255, 0.01) inset, -10px -10px 20px 0px rgba(0, 255, 25, 0.01) inset",
				},
			},
		},
		detailWrapper: {
			"@media (max-width: 768px)": {
				height: "100%",
			},
		},
		fullscreen: {
			position: "fixed",
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			zIndex: 1022,
			borderRadius: 0,
		},
		// 新增：虚拟机头部样式
		virtualMachineHeader: {
			display: "flex",
			alignItems: "center",
			gap: "4px",
			marginBottom: "14px",
			height: "24px",
		},
		statusIcon: {
			flexShrink: 0,
		},
		// 新增：虚拟机标题样式
		virtualMachineTitle: {
			fontSize: "18px",
			lineHeight: "24px",
			fontWeight: 500,
			color: token.colorText,
			flexShrink: 0,
		},
		// 新增：工具卡片样式
		toolCard: {
			display: "flex",
			alignItems: "center",
			gap: "4px",
			height: "24px",
			borderRadius: "4px",
			marginLeft: 6,
			marginRight: 16,
			padding: "4px",
			width: "fit-content",
			flexShrink: 1,
			minWidth: 0,
			boxShadow:
				"0px 4px 14px 0px rgba(255, 119, 0, 0.10), 0px 0px 1px 0px rgba(0, 0, 0, 0.30)",
			overflow: "hidden",
			whiteSpace: "nowrap",
			textOverflow: "ellipsis",
		},
		toolIcon: {
			width: "14px !important",
			height: "14px !important",
		},

		toolActionText: {
			fontSize: "12px",
			fontWeight: 400,
			lineHeight: "18px",
			color: token.colorText,
			flexShrink: 1,
			textOverflow: "ellipsis",
			overflow: "hidden",
			whiteSpace: "nowrap",
			maxWidth: "300px",
		},

		toolActionTextAnimated: {
			background:
				"linear-gradient(90deg, #EEF3FD 0%, #315CEC 17.79%, #D3DFFB 50%, #315CEC 82.21%, #EEF3FD 100%)",
			backgroundSize: "200% 100%",
			backgroundClip: "text",
			webkitBackgroundClip: "text",
			webkitTextFillColor: "transparent",
			animation: `${shimmerAnimation} 4s ease-in-out infinite`,
			color: "transparent",
		},
		// 新增：工具备注样式
		toolRemark: {
			fontSize: "12px",
			color: token.magicColorUsages.text[2],
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
			flexShrink: 1,
		},
		playbackControl: {
			borderRadius: "0 0 8px 8px",
			borderTop: "none",
			height: 46,
			padding: "10px 12px",
		},
		// 新增：回到最新进展按钮样式
		backToLatestButton: {
			position: "absolute",
			bottom: "10px",
			left: "50%",
			transform: "translateX(-50%)",
			padding: "8px 12px",
			background: token.colorBgContainer,
			color: token.magicColorUsages.text[1],
			borderRadius: "12px",
			height: "32px",
			border: "none",
			userSelect: "none",
			outline: "none",
			boxShadow: "0px 4px 14px 0px rgba(0, 0, 0, 0.10), 0px 0px 1px 0px rgba(0, 0, 0, 0.30)",
			cursor: "pointer",
			fontSize: "12px",
			lineHeight: "16px",
			zIndex: 1,
			"&:hover": {
				background: "#f5f5f5",
				boxShadow: "none",
			},
		},
		// 新增：隐藏按钮样式
		hideButton: {
			marginLeft: "auto",
			padding: "4px",
			background: "transparent",
			color: token.colorTextSecondary,
			border: "none",
			cursor: "pointer",
			fontSize: "12px",
			borderRadius: "4px",
			outline: "none",
			display: "flex",
			alignItems: "center",
			flexShrink: 0,
			gap: "4px",
			"&:hover": {
				background: token.colorBgTextHover,
			},
		},
	}
})
