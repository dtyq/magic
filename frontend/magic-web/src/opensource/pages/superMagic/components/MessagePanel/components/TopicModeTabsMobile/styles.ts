import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css }) => {
	return {
		tabsWrapper: css`
			padding: 6px 10px 0px;
			overflow-x: auto;
			scrollbar-width: none;
			&::-webkit-scrollbar {
				display: none;
			}
		`,
		tabItem: {
			position: "relative",
			display: "flex",
			alignItems: "flex-end",
			zIndex: 3,
			cursor: "pointer",
		},
		tabTitle: {
			padding: "6px 12px",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			gap: "4px",
			fontSize: token.magicFontUsages.response.text12px,
			fontWeight: 400,
			cursor: "pointer",
			whiteSpace: "nowrap",
			color: token.colorTextSecondary,
			border: `1px solid ${token.colorBorder}`,
			borderRadius: "8px",
			marginBottom: 0,
			height: 32,
			minWidth: 60,
			transition: "all 0.2s ease",
			backgroundColor: token.magicColorUsages.bg[1],
		},
		tabSvgInactive: {
			opacity: 0,
		},
	}
})
