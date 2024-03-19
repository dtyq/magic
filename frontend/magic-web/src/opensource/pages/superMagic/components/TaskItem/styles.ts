import { createStyles, keyframes } from "antd-style"

// 创建一个更加明显的脉冲动画
const pulseAnimation = keyframes`
  0% {
    transform: scale(1);
    opacity: 0.9;
  }
  50% {
    transform: scale(1.3);
    opacity: 0.4;
  }
  100% {
    transform: scale(1);
    opacity: 0;
  }
`

export const useStyles = createStyles(({ token }) => {
	return {
		progressWrapper: {
			display: "flex",
			alignItems: "center",
			gap: "8px",
		},
		currentTaskText: {
			fontSize: "14px",
			maxWidth: "500px",
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
		},
		doingIconContainer: {
			position: "relative",
			width: "14px",
			height: "14px",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
		},
		doingIconOuter: {
			position: "absolute",
			width: "14px",
			height: "14px",
			borderRadius: "50%",
			backgroundColor: "rgba(255, 236, 204, 1)",
		},
		doingIconInner: {
			position: "absolute",
			width: "8px",
			height: "8px",
			borderRadius: "50%",
			backgroundColor: "rgba(255, 125, 0, 1)",
			zIndex: 1,
		},
		doingIconPulse: {
			position: "absolute",
			width: "14px",
			height: "14px",
			borderRadius: "50%",
			backgroundColor: "rgba(255, 180, 100, 0.8)",
			animation: `${pulseAnimation} 2s infinite`,
		},
		defaultIconContainer: {
			position: "relative",
			width: "14px",
			height: "14px",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
		},
		defaultIcon: {
			position: "absolute",
			width: "8px",
			height: "8px",
			borderRadius: "50%",
			backgroundColor: token.colorTextSecondary,
		},
		statusIcon: {
			fontSize: "16px",
		},
		statusDone: {
			width: "18px",
			height: "18px",
			color: token.colorSuccess,
		},
		statusError: {
			color: token.colorError,
		},
		taskStatusDone: {
			fontSize: "14px",
			color: token.colorSuccess,
		},
		taskStatusDoing: {
			fontSize: "14px",
		},
		taskStatusError: {
			fontSize: "14px",
			color: token.colorError,
		},
		taskStatusTodo: {
			fontSize: "14px",
			color: token.colorTextSecondary,
		},
	}
})
