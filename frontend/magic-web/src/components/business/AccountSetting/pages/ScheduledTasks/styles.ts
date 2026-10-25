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
			timepickerPopup: css`
				.${prefixCls}-picker-time-panel-cell-selected
					.${prefixCls}-picker-time-panel-cell-inner {
					color: #fff !important;
				}
				.${prefixCls}-picker-time-panel-cell-selected:hover
					.${prefixCls}-picker-time-panel-cell-inner {
					color: #000 !important;
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
			display: flex;
			align-items: center;
			gap: 4px;
			max-width: 100%;
			min-width: 0;
			width: fit-content;
			min-height: 18px;
			flex-shrink: 0;
			/* Do not inherit the taller row line-height and clip the link text. */
			line-height: 14px;
			text-decoration: none;
			overflow: hidden;
			font-size: 10px;
			color: ${token.magicColorUsages.text[2]};
			border-radius: 4px;
			padding: 2px 4px;
			background-color: ${token.magicColorUsages.fill[0]};

			/* Only real links (with href) look and behave interactive. */
			&[href] {
				cursor: pointer;
			}

			&[href]:hover,
			&[href]:active {
				color: ${token.magicColorUsages.text[2]};
				text-decoration: none;
				background-color: ${token.magicColorUsages.fill[1]};
			}
		`,
		ellipsisText: css`
			flex: 1;
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		`,
		tagIcon: css`
			display: inline-flex;
			flex-shrink: 0;
		`,
		timeCol: css`
			flex: 0 0 25%;
			max-width: 25%;
			white-space: nowrap;
		`,
		infoCol: css`
			flex: 1;
			min-width: 0;
			padding: 0 12px;
		`,
		resultCol: css`
			flex: 0 0 80px;
			white-space: nowrap;
			text-align: center;
		`,
		taskName: css`
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		`,
		mobileListWrapper: css`
			height: min(62dvh, 520px);
			padding-inline: 16px;
		`,
		mobileListItem: css`
			height: auto !important;
			align-content: unset;
			padding: 16px 0 !important;
			border-bottom: 1px solid ${token.magicColorUsages.border} !important;
			margin-block-end: 0 !important;
			color: ${token.magicColorUsages.text[1]};
			font-size: 14px;
			font-weight: 400;

			&:last-child {
				border-bottom: none !important;
			}
		`,
		mobileItemWrapper: css`
			display: flex;
			flex-direction: column;
			gap: 10px;
			width: 100%;
			min-width: 0;
			padding: 0;
		`,
		mobileMetaRow: css`
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 8px;
			width: 100%;
		`,
		mobileTime: css`
			flex-shrink: 0;
			white-space: nowrap;
			font-size: 12px;
			line-height: 20px;
			color: ${token.magicColorUsages.text[3]};
		`,
		mobileStatus: css`
			flex-shrink: 0;
			line-height: 20px;
		`,
		mobileTaskName: css`
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			font-size: 15px;
			font-weight: 600;
			line-height: 22px;
			color: ${token.magicColorUsages.text[0]};
		`,
		mobilePath: css`
			display: flex;
			align-items: center;
			gap: 8px;
			width: 100%;
			min-width: 0;
			height: 40px;
			padding: 0 12px;
			border-radius: 10px;
			background-color: ${token.magicColorUsages.fill[0]};
			overflow: hidden;

			&[href] {
				cursor: pointer;
			}

			&[href]:hover,
			&[href]:active {
				color: ${token.magicColorUsages.text[2]};
				text-decoration: none;
				background-color: ${token.magicColorUsages.fill[1]};
			}
		`,
		mobilePathText: css`
			flex: 1;
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			font-size: 12px;
			line-height: 18px;
			color: ${token.magicColorUsages.text[2]};
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
			height: min(500px, calc(100dvh - 150px));
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
			width: 100%;
			min-width: 0;
			padding: 0 16px;
		`,
		headerWrapper: css`
			height: 40px;
			/* Use the same inset as record rows, without an extra list gutter. */
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
		monthlySelectorPopup: css`
			height: 200px;
		`,
		timepickerPopup: css`
			.${prefixCls}-picker-time-panel-cell-selected
				.${prefixCls}-picker-time-panel-cell-inner {
				color: #fff !important;
			}
			.${prefixCls}-picker-time-panel-cell-selected:hover
				.${prefixCls}-picker-time-panel-cell-inner {
				color: #000 !important;
			}
		`,
	}
})
