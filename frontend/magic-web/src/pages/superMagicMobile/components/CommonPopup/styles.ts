import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token }) => {
	return {
		popupBody: {
			borderRadius: 12,
			borderBottomRightRadius: 0,
			borderBottomLeftRadius: 0,
			display: "flex",
			flexDirection: "column",
			overflow: "hidden",
		},
		renderContainer: {
			width: "100%",
			marginTop: 52,
			height: "calc(100% - 52px)",
			overflow: "hidden",
		},
		bottomGap: {
			"@media (max-width: 768px)": {
				paddingBottom: `calc(56px + ${token.safeAreaInsetBottom || "0px"}) !important`,
			},
		},
		modal: {
			width: "80vw !important",
		},
		header: {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: 10,
			height: 44,
			flex: "none",
			padding: "12px",
			borderBottom: `1px solid ${token.colorBorder}`,
		},
		modalBody: {
			padding: "0 !important",
			borderBottomRightRadius: "12px",
			borderBottomLeftRadius: "12px",
			overflow: "hidden",
			height: "80vh !important",
			width: "80vw !important",
		},
		body: {
			display: "flex",
			flexDirection: "column",
			flex: "auto",
			overflow: "hidden auto",
			height: "100%",
		},
		title: {
			fontSize: 16,
			fontWeight: 600,
			lineHeight: "22px",
		},
		close: {
			flex: "none",
		},
		closeButton: {
			width: `24px !important`,
			height: `24px !important`,
		},
		headerExtra: {
			marginLeft: "auto",
		},
		nodeDetailBody: {
			paddingBottom: 48,
		},
		fileName: {
			maxWidth: "240px",
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
			fontWeight: 400,
			fontSize: 14,
			lineHeight: "20px",
			color: token.magicColorUsages.text[1],
		},
	}
})
