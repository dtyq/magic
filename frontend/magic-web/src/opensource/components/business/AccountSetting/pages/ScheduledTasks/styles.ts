import { createStyles } from "antd-style"

export const useModalStyles = createStyles(
	({ css, token, prefixCls }, { runningRecord = true }: { runningRecord?: boolean }) => {
		return {
			modal: css`
				& .${prefixCls}-modal-content {
					padding: ${runningRecord ? 20 : 0};
				}

				& .${prefixCls}-modal-body {
					padding: ${runningRecord ? "0 0 10px" : 0};
				}

				& .${prefixCls}-modal-header {
					padding: ${runningRecord ? "20px" : "14px 20px"};

					& .${prefixCls}-modal-title {
						font-size: 16px;
						font-weight: 600;
						color: ${token.magicColorUsages?.text?.[1]};
						line-height: 22px;
					}
				}

				& .${prefixCls}-modal-close {
					top: ${runningRecord ? "24px" : "19px"} !important;
					right: 20px;
					width: 24px;
					height: 24px;
					display: inline-flex;
					align-items: center;
					justify-content: center;
					color: ${token.magicColorUsages?.text?.[1]};
					cursor: pointer;
				}
			`,
		}
	},
)

export const useModifyStyles = createStyles(({ css, token, prefixCls }) => {
	return {
		desc: css`
			color: ${token.magicColorUsages.text[3]};
			font-size: 12px;
			line-height: 16px;
			text-wrap: wrap;
		`,
	}
})

export const useStyles = createStyles(({ css, token, prefixCls }) => {
	return {
		containerWrapper: css`
			padding: 10px !important;
			display: flex;
			flex-direction: column;
			gap: 10px;
			height: 100%;
		`,
		containerHeader: css`
			width: 100%;
			height: 32px;
			flex: none;
			display: flex;
			align-items: center;
			justify-content: space-between;
		`,
		containerBody: css`
			width: 100%;
			flex: 1;
			display: flex;
			overflow: hidden;

			& .${prefixCls}-table-wrapper {
				width: 100%;
			}
		`,
		table: css`
			.${prefixCls}-table-tbody tr > td {
				height: 60px;
			}
		`,
		segmented: css`
			padding: 4px;
			border-radius: 8px;
			border: 1px solid ${token.magicColorUsages.border};
		`,
		noData: css`
			width: 100%;
			height: 100%;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 4px;
		`,
		noDataText: css`
			font-size: 14px;
			font-weight: 400;
			line-height: 20px;
			color: ${token.magicColorUsages.text[3]};
		`,
		tag: css`
			width: fit-content;
			height: 18px;
			font-size: 10px;
			color: ${token.magicColorUsages.text[2]};
			border-radius: 4px;
			padding: 2px 4px;
			background-color: ${token.magicColorUsages.fill[0]};
			cursor: pointer;
		`,
		ellipsisText: css`
			max-width: 300px;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		`,
		statusTag: css`
			border: none;
		`,
		footer: css`
			height: 24px;
			color: ${token.magicColorUsages.text[3]};
			font-size: 12px;
			line-height: 24px;
			margin-top: 10px;
		`,
		listWrapper: css`
			height: 500px;
			min-height: 300px;
		`,
		listItem: css`
			height: 60px;
			align-content: center;
			border-bottom: 1px solid ${token.magicColorUsages.border} !important;
			margin-block-end: 0 !important;
			color: ${token.magicColorUsages.text[1]};
			font-size: 14px;
			font-weight: 400;
		`,
		itemWrapper: css`
			padding: 0 16px;
		`,
		headerWrapper: css`
			height: 40px;
			padding: 0 16px;
			font-size: 14px;
			color: ${token.magicColorUsages.text[0]};
			background-color: ${token.magicColorScales.grey[0]};
			border-bottom: 1px solid ${token.magicColorUsages.border};
		`,
	}
})

export const useScheduledItemStyles = createStyles(({ css, prefixCls }) => {
	return {
		container: css`
			display: flex;
			gap: 8px;
			width: 100%;
		`,
		column: css`
			flex: 1;
			width: calc(33.33% - 5.33px);
		`,
		selector: css`
			width: 100%;

			& .${prefixCls}-select-selector {
				height: 32px;
				border-radius: 6px;
			}

			& .${prefixCls}-picker {
				width: 100%;
				height: 32px;
				border-radius: 6px;
			}
		`,
	}
})
