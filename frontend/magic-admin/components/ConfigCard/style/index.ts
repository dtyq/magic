import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => {
	return {
		container: css`
			flex: 1;
			padding: 20px;
			border-radius: 8px;
			border: 1px solid ${token.magicColorUsages.border};
			background-color: ${token.magicColorUsages.bg[0]};
		`,
		title: css`
			font-size: 16px;
			font-weight: 600;
			color: ${token.magicColorUsages.text[1]};
		`,
		description: css`
			font-size: 14px;
			color: ${token.magicColorUsages.text[3]};
			overflow: hidden;
			text-overflow: ellipsis;
			line-clamp: 1;
			-webkit-line-clamp: 1;
			display: -webkit-box;
			-webkit-box-orient: vertical;
		`,
	}
})
