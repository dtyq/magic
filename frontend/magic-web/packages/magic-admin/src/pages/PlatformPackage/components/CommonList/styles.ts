import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => {
	return {
		container: css`
			padding: 10px;
			background-color: transparent;
		`,
		card: css`
			height: 120px;
			overflow: hidden;
		`,
		title: css`
			font-size: 14px;
			font-weight: 600;
			color: ${token.magicColorUsages.text[1]};
		`,
	}
})
