import { createStyles } from "antd-style"

export const useStyles = createStyles(
	({ css, token, prefixCls }, { height }: { height: number }) => ({
		tabContent: css`
			padding: 10px;
			height: 100%;
		`,
		pagination: css`
			.${prefixCls}-pagination-item-active {
				background-color: ${token.magicColorUsages.primaryLight.default};
				border: none;
			}
		`,
		table: css`
			.${prefixCls}-table-placeholder {
				td {
					border: none;
				}
			}
			.${prefixCls}-table-expanded-row-fixed {
				height: ${height}px;
				display: flex;
				align-items: center;
				justify-content: center;
			}
		`,
		button: css`
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 10px;
		`,
		description: css`
			font-size: 14px;
			color: ${token.magicColorUsages.text[3]};
		`,
	}),
)
