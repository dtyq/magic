import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => {
	return {
		menu: css`
			width: 100%;
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 8px;
		`,
		menuItem: css`
			display: flex;
			padding: 8px 10px;
			align-items: center;
			gap: 4px;
			border-radius: 8px;
			font-size: 14px;
			font-style: normal;
			font-weight: 400;
			line-height: 20px;
			cursor: pointer;
			transition: all 0.1s ease;
			color: ${token.magicColorUsages.text[1]};

			&:hover {
				background-color: ${token.magicColorUsages.fill[1]};
			}
		`,
		active: css`
			background: ${token.magicColorUsages.primaryLight.default};
			color: ${token.magicColorUsages.primary.default};
			font-weight: 500;
			&:hover {
				background-color: ${token.magicColorUsages.primaryLight.default};
			}
		`,
	}
})
