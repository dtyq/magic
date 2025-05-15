import { createStyles } from "antd-style"

// Define the styles using createStyles
export const useStyles = createStyles(({ token }) => {
	return {
		commonHeader: {
			position: "relative",
			height: "40px",
			flex: "none",
			borderBottom: `1px solid ${token.colorBorderSecondary}`,
			backgroundColor: token.colorFillSecondary,
			padding: "10px 20px",
			fontSize: 14,
			gap: 4,
			fontWeight: 400,
			lineHeight: "20px",
			color: token.colorTextSecondary,
			width: "100%",
		},
		titleContainer: {
			flex: 1,
			maxWidth: "65%",
		},
		extentTitle: {
			maxWidth: "100%",
		},
		icon: {
			flex: "none",
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
		},
		title: {
			textOverflow: "ellipsis",
			overflow: "hidden",
			whiteSpace: "nowrap",
		},
		iconCommon: {
			cursor: "pointer",
			stroke: token.colorTextSecondary,
			padding: "5px",
			borderRadius: "10px",
			userSelect: "none",
			"&:hover": {
				backgroundColor: "#2E2F380D",
			},
		},
		disabled: {
			opacity: 0.5,
			cursor: "not-allowed",
		},
		contextTag: {
			fontSize: 12,
			color: token.colorTextTertiary,
			backgroundColor: token.colorFillQuaternary,
			padding: "2px 6px",
			borderRadius: token.borderRadiusSM,
			marginLeft: 8,
		},
	}
})
