import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => {
	return {
		search: css`
			width: 276px;
			background-color: ${token.magicColorUsages.white};
			border-radius: 8px 8px 0 0;
			border-color: transparent;
			padding: 8px 12px;
			border-bottom: 1px solid ${token.magicColorUsages.border};

			&:hover,
			&:active,
			&:focus {
				border-color: transparent;
				background-color: ${token.magicColorUsages.white};
				border-bottom: 1px solid ${token.magicColorUsages.border};
			}
		`,
		title: css`
			padding-bottom: 8px;
			margin-bottom: 8px;
			border-bottom: 1px solid ${token.magicColorUsages.border};
		`,
		list: css`
			height: 188px;
			overflow-y: auto;
			padding: 8px 12px;

			&::-webkit-scrollbar {
				display: none;
			}
		`,
	}
})
