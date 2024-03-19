import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token, prefixCls }) => {
	return {
		container: css`
			border-radius: 8px;
			background-color: ${token.magicColorUsages.bg[0]};
		`,
		collapse: css`
			display: flex;
			flex-direction: column;
			gap: 10px;
			.${prefixCls}-collapse-item {
				display: flex;
				flex-direction: column;
				gap: 10px;
				border: 1px solid ${token.magicColorUsages.border};
				padding: 10px;
				border-radius: 8px;
				&:first-child {
					border-radius: 8px;
				}
				&:last-child {
					border: 1px solid ${token.magicColorUsages.border};
					border-radius: 8px;
				}
			}
			.${prefixCls}-collapse-item-active {
				padding: 10px 14px;
			}
			.${prefixCls}-collapse-header {
				padding: 0 !important;
				align-items: center !important;

				.${prefixCls}-collapse-expand-icon {
					padding-inline-end: 10px !important;
				}
			}

			.${prefixCls}-collapse-content {
				.${prefixCls}-collapse-content-box {
					padding: 0 !important;
				}
			}
		`,
		text: css`
			font-size: 14px;
			color: ${token.magicColorUsages.text[0]};
			font-weight: 600;
			overflow: hidden;
			text-overflow: ellipsis;
			text-wrap-mode: nowrap;
		`,
		formItem: css`
			margin-bottom: 0;
		`,
		modelGroup: css`
			border-radius: 8px;
			padding: 10px;
		`,
		tag: css`
			font-size: 12px;
			padding: 2px 4px;
			border-radius: 4px;
			background-color: ${token.magicColorUsages.fill[0]};
			color: ${token.magicColorUsages.text[3]};
			flex-shrink: 0;
		`,
		emptySubscription: css`
			font-size: 14px;
			line-height: 20px;
			color: ${token.magicColorUsages.text[3]};
			background-color: ${token.magicColorUsages.fill[0]};
			border-radius: 8px;
			padding: 10px;
		`,
		empty: css`
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 14px;
			color: ${token.magicColorUsages.text[3]};
			border: 1px solid ${token.magicColorUsages.border};
			border-radius: 8px;
			height: 140px;
			text-align: center;
			white-space: pre-line;
		`,
		disabledModelItem: css`
			opacity: 0.5;
		`,
	}
})
