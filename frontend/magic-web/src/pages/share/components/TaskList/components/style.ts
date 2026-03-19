import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token }) => ({
	finishedIcon: {
		color: token.colorSuccess,
	},
	waitingIcon: {
		color: token.magicColorUsages.text[3],
	},
}))
