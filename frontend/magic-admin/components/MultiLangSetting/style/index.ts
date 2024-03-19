import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token, prefixCls }) => {
	return {
		popover: css`
			.${prefixCls}-popover-title {
				font-size: 16px;
				color: ${token.magicColorUsages.text[1]};
			}
		`,
		form: css`
			width: 400px;
		`,
		formItem: css`
			margin-bottom: 10px;
			.${prefixCls}-form-item-label {
				width: 120px;
				text-align: start;
				padding: 0 0 6px !important;
				label {
					font-size: 12px;
					color: ${token.magicColorUsages.text[2]};
				}
			}
		`,
		icon: css`
			background-color: transparent;
			color: ${token.magicColorUsages.primary.default};
			&:hover {
				color: ${token.magicColorUsages.primary.hover} !important;
			}
		`,
		textIcon: css`
			background-color: transparent;
			border: none;
		`,
		errorIcon: css`
			color: ${token.magicColorUsages.danger.default};
			border-color: ${token.magicColorUsages.danger.default};
			&:hover {
				color: ${token.magicColorUsages.danger.hover} !important;
				border-color: ${token.magicColorUsages.danger.hover} !important;
			}
		`,
	}
})
