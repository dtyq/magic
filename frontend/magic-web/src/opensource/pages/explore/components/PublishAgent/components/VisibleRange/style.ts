import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css, isDarkMode }) => {
	return {
		title: css`
			font-size: 14px;
			font-weight: 600;
			color: ${isDarkMode ? token.magicColorScales.grey[1] : token.magicColorUsages.text[1]};
		`,
		desc: css`
			font-size: 12px;
			color: ${isDarkMode ? token.magicColorScales.grey[2] : token.magicColorUsages.text[2]};
		`,
		member: css`
			padding: 10px;
			border: 1px solid ${token.magicColorUsages.border};
			border-radius: 8px;
		`,
		addButton: css`
			color: ${token.magicColorUsages.primary.default};
			border: 1px solid ${token.magicColorUsages.primary.default};
			border-radius: 8px;
			margin-bottom: 10px;
		`,
		memberList: css`
			margin-top: 10px;
			flex-wrap: wrap;
		`,
		memberItem: css`
			padding: 4px;
			border-radius: 8px;
			background-color: ${token.magicColorUsages.fill[0]};
			color: ${token.magicColorUsages.text[1]};
			font-size: 14px;
			cursor: pointer;
		`,
		departmentIcon: css`
			color: white;
			border-radius: 4.5px;
			padding: 3px;
			background: ${token.magicColorScales.brand[5]};
		`,
	}
})
