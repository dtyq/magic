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

			& .simplebar-content {
				padding: 0 18px 20px 18px !important;
			}
		`,
		loading: css`
			width: 100%;
			flex: auto;
			height: calc(100% - ${headerHeight}px);
		`,
		scroll: css`
			width: 100%;
			overflow: hidden;
		`,
		card: css`
			width: 50%;
			float: left;
		`,
		emptyTips: css`
			color: ${isDarkMode ? token.magicColorScales.grey[2] : token.magicColorUsages.text[3]};
		`,
	}
})
