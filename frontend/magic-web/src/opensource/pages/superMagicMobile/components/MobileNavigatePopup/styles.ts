import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token }) => {
	return {
		container: {
			padding: "60px 20px",
		},
		group: {
			paddingBottom: 20,
			marginTop: 20,
			"&:not(:last-child)": {
				borderBottom: `1px solid ${token.magicColorUsages.border}`,
			},
		},
		groupName: {
			fontSize: 12,
			fontWeight: 400,
			lineHeight: "16px",
			color: token.magicColorUsages.text[2],
		},
		groupActions: {
			display: "flex",
			flexDirection: "column",
			gap: 4,
			marginTop: 10,
		},
		actionItem: {
			display: "flex",
			gap: 4,
			padding: 10,
			alignItems: "center",
			borderRadius: 8,

			"&:active": {
				backgroundColor: token.magicColorUsages.fill[0],
			},
		},
		iconWrapper: {
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
		},
		name: {
			fontSize: 14,
			fontWeight: 400,
			lineHeight: "20px",
		},
	}
})
