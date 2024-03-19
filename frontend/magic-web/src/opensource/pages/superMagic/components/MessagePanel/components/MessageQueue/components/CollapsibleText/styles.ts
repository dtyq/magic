import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token }) => {
	return {
		container: {
			width: "100%",
		},

		textContainer: {
			position: "relative",
			overflow: "hidden",
			transition: "max-height 0.3s ease",

			// 基础文本样式
			fontSize: "12px",
			lineHeight: "16px",
			wordBreak: "break-word",
			cursor: "pointer",
		},

		collapsed: {
			display: "-webkit-box",
			WebkitBoxOrient: "vertical",
			overflow: "hidden",
			position: "relative",

			// 渐变遮罩效果，让文本在末尾逐渐消失
			"&::after": {
				content: '""',
				position: "absolute",
				right: 0,
				bottom: 0,
				width: "60px",
				height: "16px",
				pointerEvents: "none",
			},
		},

		toggleButtonContainer: {
			display: "flex",
			justifyContent: "flex-end",
			marginTop: "4px",
		},

		toggleButton: {
			display: "flex",
			alignItems: "center",
			gap: "2px",
			border: "none",
			background: "transparent",
			cursor: "pointer",
			fontSize: "10px",
			color: token.colorPrimary,
			padding: "2px 4px",
			borderRadius: token.borderRadiusXS,
			transition: "all 0.2s ease",
			lineHeight: "12px",

			"&:hover": {
				backgroundColor: token.colorPrimaryBg,
				color: token.colorPrimaryHover,
			},

			"&:active": {
				transform: "scale(0.95)",
			},
		},

		toggleText: {
			fontSize: "10px",
			fontWeight: 400,
		},
	}
})
