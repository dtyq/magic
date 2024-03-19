import { createStyles } from "antd-style"

// Define the styles using createStyles
export const useStyles = createStyles(({ token, css }) => {
	return {
		commonHeader: {
			position: "relative",
			height: "44px",
			flex: "none",
			borderBottom: `1px solid ${token.colorBorderSecondary}`,
			backgroundColor: "white",
			padding: "10px",
			fontSize: 14,
			gap: 4,
			fontWeight: 400,
			lineHeight: "20px",
			color: token.colorTextSecondary,
			width: "100%",
			display: "flex",
		},
		titleContainer: {
			flex: "1 1 0%", // 允许伸缩，收缩比例为1
			minWidth: 0, // 确保内容可以收缩
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
		},
		extentTitle: {},
		icon: {
			flex: "none",
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			flexShrink: 0,
		},
		title: {
			textOverflow: "ellipsis",
			overflow: "hidden",
			whiteSpace: "nowrap",
			flexShrink: 0,
			flex: "auto",
			maxWidth: "fit-content",
		},
		suffixContainer: {
			flexShrink: 1,
			minWidth: 0,
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
		historyVersionContainer: css`
			width: 100%;
			padding: 6px 14px;
			background-color: ${token.magicColorUsages.primaryLight.default};
			border-bottom: 1px solid ${token.magicColorUsages.border};
			display: flex;
			align-items: center;
			justify-content: space-between;
		`,
		historyVersionTitle: css`
			display: flex;
			align-items: center;
			gap: 4px;
			font-size: 14px;
			line-height: 20px;
			color: ${token.magicColorUsages.primary.default};
			font-weight: 400;
		`,
		returnLatestButton: css`
			height: 24px;
			padding: 0 10px;
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 12px;
			line-height: 16px;
			color: ${token.magicColorUsages.text[1]};
			border-radius: 6px;
			background: none;

			&:hover {
				color: ${token.magicColorUsages.text[1]} !important;
			}
		`,
		rollbackToVersionButton: css`
			height: 24px;
			padding: 0 10px;
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 12px;
			line-height: 16px;
			border-radius: 6px;
		`,
	}
})
