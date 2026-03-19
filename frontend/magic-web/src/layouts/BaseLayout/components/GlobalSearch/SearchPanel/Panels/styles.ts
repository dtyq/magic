import { createStyles } from "antd-style"

export const useStyles = createStyles(({ prefixCls, token }) => {
	return {
		panel: {
			height: "100%",
			padding: 12,
			gap: 10,
			display: "flex",
		},
		container: {
			height: "100%",
			display: "flex",
			flexDirection: "column",
			borderRadius: "8px",
			overflow: "hidden",
			// backgroundColor: token.magicColorScales.grey[0],
			flex: "auto",
		},
		header: {
			width: "100%",
			height: "40px",
			padding: "0 12px",
			display: "flex",
			alignItems: "center",
			flex: "none",
			borderBottom: `1px solid ${token.magicColorUsages.border}`,
			color: token.magicColorUsages.text[1],
		},
		wrapper: {
			width: "100%",
			height: "fit-content",
			flex: "auto",
			overflowY: "auto",
			padding: 4,
		},
		scroll: {
			width: "100%",
			height: "100%",
		},
		title: {
			fontSize: "16px",
			fontStyle: "normal",
			fontWeight: 600,
			lineHeight: "22px",
		},
		section: {
			height: "100%",
			display: "flex",
			flexDirection: "column",
			borderRadius: "8px",
			overflow: "hidden",
			backgroundColor: token.magicColorScales.grey[0],
			flex: "auto",
			gap: 14,
			padding: 12,
		},
		sectionBody: {
			overflowY: "auto",

			[`.${prefixCls}-form-item-label`]: {
				fontSize: "14px",
				fontStyle: "normal",
				fontWeight: 600,
				lineHeight: "20px",
			},
			[`.${prefixCls}-form-item`]: {
				marginBottom: 12,
			},
		},
		empty: {
			width: "100%",
			minHeight: 220,
			display: "flex",
			flexDirection: "column",
			alignItems: "center",
			justifyContent: "center",
		},
	}
})
