import { createStyles } from "antd-style"

export const useStyles = createStyles(({ prefixCls, css, token }) => {
	return {
		form: css`
			display: flex;
			flex-direction: column;
			gap: 10px;
		`,
		required: css`
			label {
				&::after {
					content: "*" !important;
					color: ${token.magicColorUsages.danger.default};
				}
			}
		`,
		formItem: css`
			margin-bottom: 0;
			.${prefixCls}-form-item-label {
				width: 180px;
				text-align: start;
				label {
					font-size: 14px;
					color: ${token.magicColorUsages.text[1]};
				}
			}
		`,
		desc: css`
			font-size: 14px;
			color: ${token.magicColorUsages.text[3]};
		`,
		iconPreview: css`
			border: 1px solid ${token.magicColorUsages.border};
			border-radius: 8px;
			padding: 10px;
			color: ${token.magicColorUsages.text[1]};
			font-size: 14px;
		`,
		iconSelect: css`
			.${prefixCls}-select-selector {
				padding: 0 3px !important;
			}
			.${prefixCls}-select-selection-item {
				display: flex !important;
				align-items: center;
				justify-content: center;
			}
		`,
		iconWrapper: css`
			width: 50px;
			height: 50px;
			display: flex;
			align-items: center;
			justify-content: center;
			border-radius: 20px;
		`,
		imagePreview: css`
			width: 28px;
			height: 28px;
		`,
	}
})
