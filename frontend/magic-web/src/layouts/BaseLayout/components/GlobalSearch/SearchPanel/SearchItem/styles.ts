import { createStyles } from "antd-style"

// 共用样式，更改需要注意
export const useSearchItemCommonStyles = createStyles(({ token }) => {
	return {
		item: {
			width: "100%",
			height: "auto",
			padding: "8px 12px 8px 12px",
			display: "flex",
			alignItems: "flex-start",
			justifyItems: "center",
			gap: 8,
			borderRadius: "8px",
			cursor: "pointer",
			position: "relative",

			"&::before": {
				content: '""',
				position: "absolute",
				left: 0,
				bottom: 0,
				width: "100%",
				height: "1px",
				backgroundColor: token.magicColorUsages.border,
			},

			"&:hover": {
				backgroundColor: token.magicColorUsages.primaryLight.hover,
				"&::before": {
					backgroundColor: "unset",
				},
			},

			"&:active": {
				backgroundColor: token.magicColorUsages.primaryLight.active,
				"&::before": {
					backgroundColor: "unset",
				},
			},

			"&:last-child": {
				borderBottom: "unset",
			},
		},
		icon: {
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			flex: "none",
			width: 36,
			height: 36,
			margin: 2,
			backgroundColor: "#F0F0F0",
			backgroundSize: "cover",
			backgroundPosition: "center center",
			backgroundRepeat: "none",
			color: "#FFFFFF",
			borderRadius: 4,
		},
		wrapper: {
			flex: "auto",
			display: "flex",
			justifyContent: "center",
			height: "100%",
			gap: 2,
			flexDirection: "column",
			overflow: "hidden",
		},
		title: {
			fontSize: 14,
			fontStyle: "normal",
			fontWeight: 400,
			lineHeight: "20px",
			height: 20,
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
			color: token.magicColorUsages.text[0],
		},
		breadcrumb: {
			"--magic-breadcrumb-separator-margin": "4px !important",
		},
		// tag: {
		// 	display: "inline-flex",
		// 	padding: 4,
		// 	height: 20,
		// 	justifyContent: "center",
		// 	alignItems: "center",
		// 	gap: 10,
		// 	borderRadius: 4,
		// 	fontSize: 10,
		// 	fontWeight: 400,
		// 	color: "#6B6D75",
		// 	backgroundColor: "rgba(46, 47, 56, 0.05)",
		// },
		desc: {
			fontSize: 12,
			fontStyle: "normal",
			fontWeight: 400,
			lineHeight: "16px",
			height: 16,
			overflow: "hidden",
			whiteSpace: "nowrap" /* 防止文本换行 */,
			textOverflow: "ellipsis" /* 显示省略符号来代表被修剪的文本 */,
		},

		text0: {
			color: token.magicColorUsages.text[0],
		},
		text1: {
			color: token.magicColorUsages.text[1],
		},
		text2: {
			color: token.magicColorUsages.text[2],
		},
		text3: {
			color: token.magicColorUsages.text[3],
		},
	}
})
