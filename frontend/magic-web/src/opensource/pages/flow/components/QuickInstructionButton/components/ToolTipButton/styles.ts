import { createStyles } from "antd-style"

export const useStyles = createStyles(({ prefixCls, css, isDarkMode, token }) => {
	return {
		popover: css`
			padding: 10px;
		`,
		title: css`
			font-size: 14px;
			color: ${token.magicColorUsages.text[1]};
		`,
		form: css`
			display: flex;
			flex-direction: column;
			gap: 8px;
			.${prefixCls}-form-item {
				margin-bottom: 0px;
				.${prefixCls}-form-item-label {
					padding-bottom: 6px;
					label {
						font-size: 12px;
						font-weight: 400;
						line-height: 16px;
						color: ${token.magicColorUsages.text[2]};
					}
				}
			}
		`,
		input: css`
			resize: none;
			border: 1px solid ${isDarkMode ? token.magicColorUsages.border : token.magicColorUsages.border};
			background: ${isDarkMode ? token.magicColorUsages.fill[0] : token.magicColorUsages.fill[0]};
			--${prefixCls}-input-active-shadow: none !important;
			&::placeholder  {
				color: ${token.magicColorUsages.text[3]};
			}
			&:hover, &:focus{
				border: 1px solid ${isDarkMode ? token.magicColorUsages.border : token.magicColorUsages.border};
				background: ${isDarkMode ? token.magicColorUsages.fill[0] : token.magicColorUsages.fill[0]};
			}
			.${prefixCls}-input-suffix {
				position: absolute;
				right: 12px;
				bottom: 24px;
			}
		`,
		upload: css`
			width: 280px;
			height: 160px;
			display: flex;
			flex-direction: column;
			justify-content: center;
			align-items: center;
			border-radius: 8px;
			border: 1px dashed
				${isDarkMode ? token.magicColorUsages.border : token.magicColorUsages.border};
			background: ${isDarkMode
				? token.magicColorUsages.fill[0]
				: token.magicColorUsages.fill[0]};
			overflow: hidden;
		`,
		uploadTip: css`
			font-size: 12px;
			font-weight: 400;
			cursor: default;
			color: ${isDarkMode ? token.magicColorUsages.text[3] : token.magicColorUsages.text[3]};
			width: 280px;
			height: 160px;
			display: flex;
			align-items: center;
			justify-content: center;
		`,
		img: css`
			width: 100%;
		`,
		button: css`
			padding: 6px 12px;
			border: 0;
			border-radius: 8px;
			background-color: ${token.magicColorUsages.fill[0]};
			color: ${isDarkMode ? token.magicColorUsages.text[2] : token.magicColorUsages.text[1]};
		`,
		example: css`
			color: ${isDarkMode ? token.magicColorUsages.text[0] : token.magicColorUsages.text[0]};
		`,
		exampleImg: css`
			width: 100%;
			border-radius: 12px;
		`,
		exampleTitle: css`
			font-weight: 600;
			color: ${isDarkMode ? token.magicColorUsages.text[2] : token.magicColorUsages.text[2]};
		`,
		exampleDesc: css`
			color: ${isDarkMode ? token.magicColorUsages.text[2] : token.magicColorUsages.text[2]};
		`,
	}
})
