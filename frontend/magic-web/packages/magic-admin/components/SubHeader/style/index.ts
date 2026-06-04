import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => {
	return {
		header: css`
			height: 32px;
			padding-left: 10px;
			border-left: 2px solid ${token.magicColorUsages.primary.default};
		`,
		title: css`
			font-size: 16px;
			font-weight: 600;
			text-wrap: nowrap;
			line-height: 32px;
			color: ${token.magicColorUsages.text[1]};
		`,
		description: css`
			font-size: 14px;
			color: ${token.magicColorUsages.text[2]};
		`,
	}
})
