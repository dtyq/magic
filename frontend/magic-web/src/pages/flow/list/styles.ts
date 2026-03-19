import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, isDarkMode, token }) => {
	return {
		container: css`
			background-color: ${isDarkMode ? "transparent" : token.magicColorUsages.white};
			width: 100%;
			position: relative;
			flex: 1;
			min-width: 480px;
		`,
		title: css`
			color: ${isDarkMode ? token.magicColorUsages.white : token.magicColorUsages.text[1]};
			font-size: 14px;
			line-height: 24px;
			margin: 0;
		`,
		top: css`
			height: 72px;
			padding: 0 20px;
			width: 100%;
			top: 0;
			backdrop-filter: blur(12px);
			z-index: 1;
		`,
		search: css`
			width: 200px !important;
		`,
		wrapper: css`
			flex: 1;
			padding: 0 20px 20px;
			height: calc(100vh - 168px);
			overflow-y: auto;
			::-webkit-scrollbar {
				display: none;
			}
		`,
		scrollWrapper: css`
			::-webkit-scrollbar {
				display: none;
			}
		`,
		main: css`
			margin: 64px 0 100px 0;
		`,
		navList: css`
			height: 60px;
			display: flex;
			align-items: center;
			gap: 10px;
		`,
		navItem: css`
			cursor: pointer;
			height: 30px;

			&:hover {
				background: ${isDarkMode
					? token.magicColorScales.grey[8]
					: token.magicColorScales.grey[0]};
			}

			border-radius: 8px;
			padding: 4px 20px;
			display: flex;
			align-items: center;
			gap: 4px;
			color: ${isDarkMode ? token.magicColorScales.grey[2] : token.magicColorUsages.text[1]};
		`,
		selected: css`
			background: ${isDarkMode
				? token.magicColorScales.grey[8]
				: token.magicColorScales.grey[0]};
		`,
		content: css`
			flex: 1;
		`,
		empty: css`
			margin: 12px auto;
		`,
		emptyTips: css`
			color: ${isDarkMode ? token.magicColorScales.grey[2] : token.magicColorUsages.text[3]};
		`,
		flowEmptyImage: css``,
		isEmptyList: css`
			display: flex;
			justify-content: center;
			align-items: center;
		`,
		moreOperations: css`
			.magic-dropdown-menu-item-only-child {
				padding: 3px 8px;

				.icon {
					padding: 3px;
				}
			}
		`,
		leftTitle: css`
			color: ${isDarkMode ? token.magicColorUsages.white : token.magicColorUsages.text[1]};
			font-size: 18px;
			font-weight: 600;
			line-height: 24px;
			text-align: left;
		`,
		listItem: css`
			margin-block-end: 8px !important;
		`,
	}
})
