import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token, prefixCls }) => {
	return {
		magicCollapse: css`
			border: none;
			background-color: ${token.magicColorUsages.bg[0]};
			.${prefixCls}-collapse-item {
				border-bottom: none;
				background-color: ${token.magicColorScales.grey[0]};
				border-radius: 8px;
				border: 1px solid ${token.magicColorUsages.border};
				.${prefixCls}-collapse-header {
					display: flex;
					align-items: center;
					padding: 10px;
					color: ${token.magicColorUsages.text[1]};
					font-weight: 600;
					border-radius: 8px;
					.${prefixCls}-collapse-expand-icon {
						padding-inline-start: 6px !important;
					}
				}
			}
			.${prefixCls}-collapse-content {
				border-top: none;
				.${prefixCls}-collapse-content-box {
					padding: 0;
					border-radius: 0 0 8px 8px;
				}
			}
		`,
	}
})
