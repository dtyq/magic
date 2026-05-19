import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token, isDarkMode }) => {
	const headerHeight = 64
	return {
		page: css`
			width: 100%;
			height: 100%;
			position: relative;
			display: flex;
			min-width: 480px;
		`,
		layout: css`
			overscroll-behavior-x: none;
			flex: auto;
			height: 100%;
			display: flex;
			flex-direction: column;
			overflow: hidden;
		`,
		header: css`
			width: 100%;
			padding: 20px;
			flex: none;
			height: ${headerHeight}px;
		`,
		menu: css`
			display: inline-flex;
			gap: 8px;
			align-items: center;
			color: ${token.magicColorUsages.text[3]};
		`,
		headerTitle: css`
			color: ${token.magicColorUsages.text[1]};
			font-size: 18px;
			font-style: normal;
			font-weight: 600;
			line-height: 24px; /* 133.333% */
		`,
		container: css`
			width: 100%;
			height: 100%;
			overflow: auto;

			& .simplebar-content {
				padding: 0 18px 20px 18px !important;
			}
		`,
		loading: css`
			width: 100%;
			flex: 1;
			height: calc(100% - ${headerHeight}px);
		`,
		loadingInner: css`
			width: 100%;
			height: 100%;
		`,
		scroll: css`
			display: grid;
			grid-template-columns: repeat(2, 1fr);
			width: 100%;
			::-webkit-scrollbar {
				display: none;
			}
		`,
		card: css`
			/* grid item - 必须设置 min-width: 0 防止内容撑开列宽 */
			min-width: 0;
		`,
		emptyTips: css`
			color: ${isDarkMode ? token.magicColorScales.grey[2] : token.magicColorUsages.text[3]};
			padding: 20px 0;
		`,
		emptyContainer: css`
			width: 100%;
			height: 100%;
			display: flex;
			align-items: center;
			justify-content: center;
		`,
	}
})
