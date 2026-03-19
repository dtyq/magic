import { createStyles, cx } from "antd-style"

export const useMagicListItemStyles = createStyles(({ css, isDarkMode, token }) => {
	const extra = cx(css`
		color: ${isDarkMode ? token.magicColorScales.grey[4] : token.magicColorUsages.text[1]};
		cursor: pointer;
		display: none;
		flex-shrink: 0;
		max-height: 100%;
		overflow: hidden;
	`)

	const mainWrapper = cx(css`
		max-width: 100%;
		overflow: hidden;
	`)

	return {
		container: css`
			padding: 10px;
			border-radius: 8px;
			cursor: pointer;
			position: relative;
			max-width: 100%;
			flex: 1;

			&:hover {
				.${extra} {
					display: block;
				}
				background-color: ${isDarkMode
					? token.magicColorScales.grey[0]
					: token.magicColorScales.grey[0]};
			}
			&:active {
				background-color: ${isDarkMode
					? token.magicColorScales.grey[1]
					: token.magicColorScales.grey[0]};
			}
		`,
		active: css`
			background-color: ${isDarkMode
				? token.magicColorUsages.primaryLight.default
				: token.magicColorUsages.primaryLight.default};
		`,
		mainWrapper,
		avatar: css`
			flex-shrink: 0;
		`,
		title: css`
			overflow: hidden;
			color: ${isDarkMode ? token.magicColorUsages.white : token.magicColorUsages.text[1]};
			text-overflow: ellipsis;
			font-size: 14px;
			font-weight: 400;
			line-height: 20px;
			white-space: nowrap;
		`,
		content: css`
			flex-shrink: 1;
			overflow: hidden;
			color: ${isDarkMode ? token.magicColorScales.grey[5] : token.magicColorUsages.text[3]};
			text-overflow: ellipsis;
			font-size: 12px;
			font-weight: 400;
			line-height: 16px;
			white-space: nowrap;
			max-width: 100%;
		`,
		time: css`
			overflow: hidden;
			color: ${isDarkMode ? token.magicColorScales.grey[5] : token.magicColorUsages.text[3]};
			text-align: right;
			text-overflow: ellipsis;
			font-size: 12px;
			font-weight: 400;
			line-height: 16px;
			flex-shrink: 0;
		`,
		extra,
	}
})
