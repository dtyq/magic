import { createStyles } from "antd-style"

const useStyles = createStyles(({ css, token, prefixCls }) => {
	return {
		commonFooter: css`
			width: 100%;
			height: 34px;
			padding: 4px 10px;
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 10px;
			font-size: 12px;
			line-height: 16px;
			color: ${token.magicColorUsages.text[1]};
			border-top: 1px solid ${token.magicColorUsages.border};
			background-color: ${token.magicColorUsages.bg[1]};
		`,
		versionSelector: css`
			display: flex;
			align-items: stretch;
			gap: 4px;
		`,
		versionSelectorAvaible: css`
			cursor: pointer;
		`,
		version: css`
			padding: 2px 10px;
			font-size: 10px;
			line-height: 13px;
			border-radius: 4px;
			background-color: ${token.magicColorUsages.fill[0]};
		`,
		selectorIcon: css`
			width: 18px;
			height: 18px;
			display: flex;
			align-items: center;
			justify-content: center;
		`,
		popover: css`
			.${prefixCls}-popover-inner {
				padding: 10px;
			}
		`,
		versionList: css`
			max-height: 400px;
			display: flex;
			flex-direction: column;
			gap: 4px;
			overflow-y: auto;

			&::-webkit-scrollbar {
				width: 4px;
			}
			&::-webkit-scrollbar-thumb {
				background-color: #fff;
				border-radius: 4px;
			}
			&::-webkit-scrollbar-track {
				background-color: transparent;
			}
		`,
		versionItem: css`
			padding: 6px 10px;
			display: flex;
			justify-content: space-between;
			align-items: center;
			gap: 20px;
			font-size: 12px;
			line-height: 16px;
			color: ${token.magicColorUsages.text[1]};
			border-radius: 4px;
			background-color: ${token.magicColorUsages.bg[3]};
			cursor: pointer;
			transition: background-color 0.3s ease;

			&:hover {
				background-color: ${token.magicColorUsages.fill[0]};
			}
		`,
		checkedVersionItem: css`
			background-color: ${token.magicColorUsages.primaryLight.default};
			cursor: default;

			&:hover {
				background-color: ${token.magicColorUsages.primaryLight.default};
			}
		`,
		createdAt: css`
			font-size: 10px;
			line-height: 13px;
			color: ${token.magicColorUsages.text[3]};
		`,
		checkedIcon: css`
			display: flex;
			align-items: center;
			justify-content: center;
			color: ${token.magicColorUsages.primary.default};
		`,
		loadMoreHint: css`
			padding: 6px 8px;
			font-size: 12px;
			line-height: 16px;
			color: ${token.magicColorUsages.text[2]};
			background-color: ${token.magicColorUsages.fill[0]};
			border-radius: 4px;
		`,
		returnLatestButton: css`
			height: 24px;
			padding: 0 10px;
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 12px;
			line-height: 16px;
			color: ${token.magicColorUsages.text[1]};
			border-radius: 6px;

			&:hover {
				color: ${token.magicColorUsages.text[1]} !important;
			}
		`,
		rollbackToVersionButton: css`
			height: 24px;
			padding: 0 10px;
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 12px;
			line-height: 16px;
			border-radius: 6px;
		`,
		loadingIndicator: css`
			padding: 8px 10px;
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 8px;
			font-size: 12px;
			line-height: 16px;
			color: ${token.magicColorUsages.text[2]};
			background-color: ${token.magicColorUsages.bg[2]};
		`,
	}
})

export default useStyles
