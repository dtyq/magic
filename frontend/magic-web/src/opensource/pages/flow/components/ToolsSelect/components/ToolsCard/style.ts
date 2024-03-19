import { createStyles } from "antd-style"

const useStyles = createStyles(
	({ css, isDarkMode, token }, { cardOpen }: { cardOpen: boolean }) => {
		return {
			toolsetWrap: css``,
			divider: css`
				margin: 0 !important;
				display: ${cardOpen ? "flex" : "none"};
			`,
			tools: css`
				height: 0;
				overflow: hidden;
				transition: height 0.2s;
			`,
			cardOpen: css`
				height: auto;
				max-height: 200px;
				overflow-y: auto;
			`,
			cardWrapper: css`
				font-size: 12px;
				line-height: 16px;
				font-weight: 400;
				padding: 12px;
				border-radius: 8px;
				color: ${isDarkMode
					? token.magicColorScales.grey[2]
					: token.magicColorUsages.text[2]};
				border: 1px solid ${isDarkMode ? token.magicColorScales.grey[4] : token.colorBorder};
				position: relative;
				cursor: pointer;
			`,
			checked: css`
				border-width: 2px;
				border-color: ${token.magicColorScales.brand[5]};
			`,
			moreOperations: css`
				position: absolute;
				right: 12px;
				top: 12px;
				z-index: 10;
				cursor: pointer;
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
				color: ${isDarkMode
					? token.magicColorUsages.text[3]
					: token.magicColorUsages.text[2]};
				border: none;
			`,
			blue: css`
				background-color: ${isDarkMode
					? token.magicColorScales.brand[8]
					: token.magicColorScales.brand[0]};
				color: ${isDarkMode
					? token.magicColorUsages.text[3]
					: token.magicColorUsages.text[2]};
				border: none;
			`,
		}
	},
)

export default useStyles
