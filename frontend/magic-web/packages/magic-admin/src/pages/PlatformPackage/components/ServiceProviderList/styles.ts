import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => {
	return {
		status: css`
			font-size: 12px;
			color: ${token.magicColorUsages.text[2]};
			text-wrap: noWrap;
		`,
		button: css`
			font-size: 12px;
		`,
	}
})
