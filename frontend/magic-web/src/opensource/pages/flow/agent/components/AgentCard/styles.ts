import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, isDarkMode, token }) => {
	return {
		cardWrapper: css`
			font-size: 12px;
			line-height: 16px;
			font-weight: 400;
			padding: 12px;
			border-radius: 8px;
			color: ${isDarkMode ? token.magicColorScales.grey[2] : token.magicColorUsages.text[2]};
			border: 1px solid ${token.colorBorder};
			position: relative;
			cursor: pointer;
			min-height: 142px;
		`,
		statusWrapper: css`
			height: 24px;
		`,
		tag: css`
			margin-right: 0;
			display: flex;
			align-items: center;
			gap: 2px;
		`,
		green: css`
			background-color: ${isDarkMode
				? token.magicColorScales.green[0]
				: token.magicColorScales.green[0]};
			color: ${isDarkMode
				? token.magicColorScales.green[5]
				: token.magicColorScales.green[5]};
			border: none;
		`,
		orange: css`
			background-color: ${isDarkMode
				? token.magicColorUsages.fill[2]
				: token.magicColorUsages.fill[0]};
			color: ${isDarkMode ? token.magicColorUsages.text[3] : token.magicColorUsages.text[2]};
			border: none;
		`,
		blue: css`
			background-color: ${isDarkMode
				? token.magicColorScales.brand[8]
				: token.magicColorScales.brand[0]};
			color: ${isDarkMode ? token.magicColorUsages.text[3] : token.magicColorUsages.text[2]};
			border: none;
		`,
	}
})
