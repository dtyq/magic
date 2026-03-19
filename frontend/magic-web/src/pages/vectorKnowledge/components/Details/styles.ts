import { createStyles } from "antd-style"

export const useVectorKnowledgeDetailStyles = createStyles(
	({ css, token, isDarkMode, prefixCls }) => {
		return {
			wrapper: css`
				height: 100%;
			`,
			leftContainer: css`
				min-width: 250px;
				border-right: 1px solid
					${isDarkMode ? token.magicColorScales.grey[8] : token.magicColorUsages.border};
			`,
			rightContainer: css`
				flex: 1;
				height: 100%;
				padding: 20px;
				overflow-x: auto;
			`,
			header: css`
				padding: 13px 20px;
				border-bottom: 1px solid ${token.colorBorder};
				font-size: 18px;
				font-weight: 600;
				color: ${isDarkMode
					? token.magicColorScales.grey[9]
					: token.magicColorUsages.text[1]};
				background: ${isDarkMode ? "transparent" : token.magicColorUsages.white};
				height: 50px;
			`,
			arrow: css`
				border-radius: 4px;
				cursor: pointer;
				&:hover {
					background: ${isDarkMode
						? token.magicColorScales.grey[6]
						: token.magicColorScales.grey[0]};
				}
			`,
		}
	},
)
