import { createStyles } from "antd-style"

const useStyles = createStyles(({ token, css }) => {
	return {
		container: css`
			max-width: 960px;
			height: 100%;
			padding: 50px 10px 0;
			margin: 0 auto;
			display: flex;
			flex-direction: column;
			gap: 20px;
			overflow: hidden;
		`,
		title: css`
			font-size: 24px;
			line-height: 32px;
			font-weight: 600;
			color: ${token.magicColorUsages.text[1]};
		`,
		projects: css`
			flex: 1;
			padding-right: 2px;
			display: grid;
			grid-template-columns: repeat(4, 1fr);
			grid-auto-rows: min-content; // 让行高根据内容自适应
			gap: 10px;
			overflow-y: auto;

			&::-webkit-scrollbar {
				width: 6px;
			}
			&::-webkit-scrollbar-thumb {
				background-color: rgba(0, 0, 0, 0.3);
				border-radius: 4px;
			}
			&::-webkit-scrollbar-track {
				background-color: transparent;
			}
		`,
		projectItem: css`
			padding: 10px;
			display: flex;
			flex-direction: column;
			gap: 10px;
			border-radius: 8px;
			border: 1px solid ${token.magicColorUsages.border};
			background: ${token.magicColorUsages.bg[1]};
			min-width: 0; // 允许flex子元素收缩到比内容更小
		`,
		projectItemContentWrapper: css`
			display: flex;
			flex-direction: column;
			gap: 10px;
			cursor: pointer;
		`,
		projectItemIcon: css`
			height: 116px;
			background: #f9f9f9;
			border-radius: 4px;
			padding: 8px;
			display: flex;
			align-items: center;
			justify-content: center;
		`,
		projectItemContent: css`
			display: flex;
			flex-direction: column;
			gap: 4px;
		`,
		projectItemTitle: css`
			font-weight: 600;
			font-size: 14px;
			line-height: 20px;
			color: ${token.magicColorUsages.text[1]};
		`,
		projectItemUpdatedAt: css`
			font-size: 10px;
			font-weight: 400;
			line-height: 13px;
			color: ${token.magicColorUsages.text[2]};
		`,
		divider: css`
			width: 100%;
			height: 1px;
			background: ${token.magicColorUsages.border};
		`,
		projectItemFooter: css`
			display: flex;
			align-items: center;
			font-size: 12px;
			gap: 4px;
			line-height: 16px;
			color: ${token.magicColorUsages.text[3]};
		`,
		projectItemFooterContent: css`
			padding: 2px 6px;
			display: flex;
			align-items: center;
			gap: 4px;
			font-size: 12px;
			line-height: 16px;
			color: ${token.magicColorUsages.text[1]};
			background: ${token.magicColorUsages.fill[0]};
			border-radius: 4px;
			cursor: pointer;

			&:hover {
				font-weight: 600;
			}
		`,
		loadingContainer: css`
			grid-column: 1 / -1;
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 8px;
			padding: 20px;
			color: ${token.magicColorUsages.text[2]};
		`,
		loadingText: css`
			font-size: 14px;
			line-height: 20px;
			color: ${token.magicColorUsages.text[2]};
		`,
		noMoreContainer: css`
			grid-column: 1 / -1;
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 20px;
		`,
		noMoreText: css`
			font-size: 14px;
			line-height: 20px;
			color: ${token.magicColorUsages.text[3]};
			opacity: 0.6;
		`,
	}
})

export default useStyles
