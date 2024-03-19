import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token, prefixCls }) => {
	return {
		wrapper: css`
			width: 100%;
			height: 100%;
			flex-basis: auto;
			gap: 10px;
			display: flex;
			flex-direction: column;
			justify-content: space-between;
			overflow: hidden;
		`,
		table: css`
			width: 100%;
			flex-basis: auto;
			overflow: hidden;
		`,
		tableHeader: css`
			height: 40px;
			padding-right: 20px;

			@media (max-width: 768px) {
				padding-right: 0px;
			}
		`,
		scroll: css`
			width: 100%;
			height: calc(100% - 40px);

			& .simplebar-content {
				padding: 0 20px 0 0 !important;

				@media (max-width: 768px) {
					padding: 0 !important;
				}
			}
		`,
		pagination: css`
			flex: none;
			width: 100%;
			height: 32px;
			padding: 0 20px;
			display: flex;
			justify-content: flex-end;
		`,
		item: css`
			width: 100%;
			height: 50px;
			display: flex;
		`,
		itemLastProject: css`
			border-bottom: none;
		`,
		itemCell: css`
			height: 100%;
			padding: 0 10px;
			display: inline-flex;
			align-items: center;
			flex: none;
			color: ${token.magicColorUsages.text[2]};
			text-overflow: ellipsis;
			font-size: 12px;
			font-style: normal;
			font-weight: 400;
			line-height: 16px; /* 133.333% */
			border-bottom: 1px solid ${token.magicColorUsages.border};
		`,
		itemName: css`
			flex: auto;
			display: flex;
			justify-content: space-between;
			align-items: center;
			gap: 4px;
			overflow: hidden;
		`,
		itemProjectName: css`
			padding-left: 40px;
		`,
		itemStatus: css`
			width: 60px;

			@media (max-width: 768px) {
				width: 46px;
			}
		`,
		itemSetting: css`
			width: 68px;
			display: flex;
			padding: 0 10px;
			gap: 10px;

			@media (max-width: 768px) {
				width: 78px;
			}
		`,
		text: css`
			flex: 1;
			font-size: 14px;
			font-weight: 400;
			line-height: 20px; /* 142.857% */
			color: ${token.magicColorUsages.text[1]};
		`,
		memoryTooltipContent: css`
			max-width: 300px;
			max-height: 100px;
			overflow-y: auto;

			&::-webkit-scrollbar {
				width: 4px;
			}
			&::-webkit-scrollbar-thumb {
				background-color: rgba(255, 255, 255, 0.3);
				border-radius: 4px;
			}
			&::-webkit-scrollbar-track {
				background-color: transparent;
			}
		`,
		tag: css`
			display: flex;
			flex: none;
			height: 20px;
			padding: 3px 6px;
			justify-content: center;
			align-items: center;
			border-radius: 4px;
			border: 1px solid ${token.magicColorUsages.border};
			background-color: ${token.magicColorUsages.white};
			color: ${token.magicColorUsages.text[2]};
			font-size: 10px;
			font-style: normal;
			font-weight: 400;
			line-height: 13px; /* 130% */
		`,
		button: css`
			flex: none;
			width: 24px;
			height: 24px;
			display: flex;
			align-items: center;
			justify-content: center;
			cursor: pointer;
			transition: all linear 0.1s;
			border-radius: 6px;
			color: ${token.magicColorUsages.text[1]};

			&:hover {
				background-color: ${token.magicColorUsages.fill[0]};
			}

			&:active {
				background-color: ${token.magicColorUsages.fill[1]};
			}
		`,

		empty: css`
			width: 100%;
			height: 100%;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 4px;
			color: ${token.magicColorUsages.text[3]};
			font-size: 12px;
			line-height: 20px;
		`,

		// 项目记忆折叠面板样式
		projectCollapse: css`
			.${prefixCls}-collapse-header {
				align-items: center !important;
			}

			.${prefixCls}-collapse-header-text {
				font-size: 12px;
				line-height: 16px;
				font-weight: 600;
				color: ${token.magicColorUsages.text[0]};
			}

			.${prefixCls}-collapse-content-box {
				padding: 0 !important;
			}

			.${prefixCls}-collapse-item {
				border-bottom: 1px solid ${token.magicColorUsages.border} !important;
			}
		`,
	}
})
