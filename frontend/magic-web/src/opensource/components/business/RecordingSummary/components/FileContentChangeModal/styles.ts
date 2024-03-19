import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token, prefixCls }) => {
	return {
		modal: css``,
		titleDescription: css`
			color: ${token.magicColorUsages.text[3]};
			font-size: 12px;
			line-height: 16px;
			font-weight: 400;
		`,
		content: css`
			max-height: 80vh;
		`,
	}
})
