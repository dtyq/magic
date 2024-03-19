import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token }) => {
	return {
		browserHeader: {
			flex: "none",
			display: "flex",
			alignItems: "center",
			height: 40,
			padding: "0 16px",
			gap: 6,
			backgroundColor: token.magicColorUsages.fill[1],
		},
		dot: {
			width: 10,
			height: 10,
			borderRadius: "50%",
		},
		red: {
			backgroundColor: token.magicColorScales.red[5],
		},
		yellow: {
			backgroundColor: token.magicColorScales.yellow[5],
		},
		green: {
			backgroundColor: token.magicColorScales.green[5],
		},
	}
})
