import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css }) => {
	return {
		arrowUp: css`
			color: ${token.magicColorScales.orange[5]};
			cursor: pointer;
		`,
	}
})
