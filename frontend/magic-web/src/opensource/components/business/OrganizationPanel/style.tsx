import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, isDarkMode, token, prefixCls }) => {
	return {
		container: css`
			display: flex;
			flex-direction: column;
			height: 100%;

			.${prefixCls}-spin-nested-loading {
				height: 100%;
				flex: 1;

				.${prefixCls}-spin {
					max-height: unset;
				}
			}
			.${prefixCls}-spin-container {
				display: flex;
				flex-direction: column;
				height: 100%;
			}
		`,
		list: css`
			height: 100%;
			display: flex;
			flex-direction: column;
			gap: 2px;
			overflow-y: auto;
		`,
		listItem: css`
			&:hover {
				background-color: ${isDarkMode
					? token.magicColorScales.grey[1]
					: token.magicColorScales.grey[0]};
			}
			border-radius: 8px;
		`,
		selectAllWrapper: css`
			padding: 8px 10px;
		`,
		button: css`
			height: 32px;
			font-size: 14px;
			border-radius: 8px;
			padding: 6px 10px;
			background-color: ${token.magicColorScales.orange[0]};
			color: ${token.magicColorUsages.text[1]};
		`,
	}
})
