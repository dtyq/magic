import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css, isDarkMode }) => {
	return {
		defaultButton: css`
			border: 0;
			background-color: ${isDarkMode
				? token.magicColorScales.grey[2]
				: token.magicColorUsages.fill[0]};
		`,
		button: css`
			width: 240px;
			height: 32px;
			border-radius: 8px;
		`,
		successContainer: css`
			padding: 14px 0;
		`,
		successText: css`
			font-size: 12px;
			color: ${isDarkMode ? token.magicColorScales.grey[4] : token.magicColorUsages.text[3]};
		`,
		successTitle: css`
			font-size: 14px;
			color: ${isDarkMode ? token.magicColorScales.grey[1] : token.magicColorUsages.text[1]};
		`,
	}
})
