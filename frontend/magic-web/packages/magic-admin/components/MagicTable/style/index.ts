import { createStyles } from "antd-style"

export const useStyles = createStyles(({ prefixCls, token, css }) => {
	return {
		magicTable: css`
			.${prefixCls}-table {
				color: ${token.magicColorUsages.text[1]};
			}

			.${prefixCls}-table-thead {
				tr > th {
					color: ${token.magicColorUsages.text[0]};
					font-size: 14px;
					font-weight: 400;
					background-color: ${token.magicColorScales.grey[0]};
					border-bottom: 1px solid ${token.magicColorUsages.border};
					padding: 12px 16px;
				}
			}
		`,
	}
})
