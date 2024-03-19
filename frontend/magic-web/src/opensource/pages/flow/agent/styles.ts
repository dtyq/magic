import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, prefixCls, isDarkMode, token }) => {
	return {
		container: css`
			background-color: ${isDarkMode ? "transparent" : token.magicColorUsages.white};
			width: 100%;
			position: relative;
			height: 100%;
		`,
		title: css`
			color: ${isDarkMode ? token.magicColorUsages.white : token.magicColorUsages.text[1]};
			font-size: 14px;
			line-height: 24px;
			margin: 0;
		`,
		top: css`
			height: 72px;
			padding: 20px;
			width: 100%;
		`,
		search: css`
			width: 220px !important;
		`,
		select: css`
			.${prefixCls}-select-selector {
				width: 120px !important;
				padding-left: 12px !important;
			}
		`,
		wrapper: css`
			flex: 1;
			padding: 0 20px 20px;
			height: calc(100vh - 128px);
			overflow-y: auto;
			overflow-x: hidden;
			::-webkit-scrollbar {
				display: none;
			}
		`,
		scrollWrapper: css`
			::-webkit-scrollbar {
				display: none;
			}
		`,
		cardWrapper: css`
			height: 142px;
			font-size: 12px;
			font-weight: 400;
			padding: 12px;
			border-radius: 8px;
			color: ${isDarkMode ? token.magicColorScales.grey[2] : token.magicColorUsages.text[2]};
			border: 1px solid ${isDarkMode ? token.magicColorScales.grey[4] : token.colorBorder};
			position: relative;
		`,
		more: css`
			position: absolute;
			right: 12px;
			top: 12px;
			cursor: pointer;
			z-index: 9;
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
		EmptyImage: css``,
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
