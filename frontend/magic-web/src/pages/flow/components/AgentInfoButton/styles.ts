import { createStyles } from "antd-style"

export const useStyles = createStyles(({ prefixCls, css, isDarkMode, token }) => {
	return {
		agentInfo: css`
			padding-bottom: 16px;
			border-bottom: 1px solid
				${isDarkMode ? token.magicColorScales.grey[4] : token.colorBorder};
		`,
		icon: css`
			width: 20px;
			height: 20px;
			border-radius: 4px;
		`,
		text2: css`
			color: ${isDarkMode ? token.magicColorScales.grey[5] : token.magicColorUsages.text[2]};
		`,
		text3: css`
			font-size: 12px;
			color: ${isDarkMode ? token.magicColorScales.grey[5] : token.magicColorUsages.text[3]};
		`,
		font12: css`
			font-size: 12px;
		`,
		tag: css`
			margin-right: 0;
			display: flex;
			align-items: center;
			gap: 2px;
			border: 0;
			background-color: ${isDarkMode
				? token.magicColorUsages.fill[2]
				: token.magicColorUsages.fill[0]};
		`,
		button: css`
			width: 275px;
			border: 0;
			background-color: ${isDarkMode
				? token.magicColorUsages.fill[2]
				: token.magicColorUsages.fill[0]};
			color: ${isDarkMode ? token.magicColorScales.grey[1] : token.magicColorUsages.text[1]};
		`,
		delete: css`
			background-color: ${isDarkMode
				? token.magicColorScales.red[0]
				: token.magicColorScales.red[0]};
			color: ${isDarkMode ? token.magicColorScales.red[4] : token.magicColorScales.red[4]};
		`,
		transfer: css`
			color: ${isDarkMode
				? token.magicColorScales.brand[5]
				: token.magicColorScales.brand[5]};
		`,
		iconButton: css`
			width: 44px !important;
			padding: 8px;
			border-radius: 8px;
			background-color: ${token.magicColorUsages.white};
			&:hover {
				background-color: ${token.magicColorUsages.white} !important;
			}
		`,
		switch: css`
			width: 40px;
			height: 24px;
			background-color: ${token.magicColorUsages.white};
			border: 1px solid ${token.colorBorder};
			.${prefixCls}-switch-handle {
				&::before {
					width: 18px;
					height: 18px;
					box-shadow: none;
					border: 1px solid ${token.magicColorUsages.border};
				}
			}
			&:hover {
				background-color: ${token.magicColorScales.grey[1]} !important;
			}
		`,
		switchChecked: css`
			background: ${token.magicColorScales.green[5]} !important;
			&:hover {
				background: ${token.magicColorScales.green[6]} !important;
			}
		`,
	}
})
