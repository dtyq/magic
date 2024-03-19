import { createStyles } from "antd-style"

export const useStyles = createStyles(({ prefixCls, css, token }) => {
	return {
		form: css`
			display: flex;
			flex-direction: column;
			gap: 20px;
		`,
		formItem: css`
			margin-bottom: 0;
			.${prefixCls}-form-item-label {
				width: 140px;
				text-align: start;
				label {
					font-size: 14px;
					color: ${token.magicColorUsages.text[1]};
				}
			}
		`,
		testStatus: css`
			font-size: 14px;
			color: ${token.magicColorUsages.success.default};
		`,
		error: css`
			color: ${token.magicColorUsages.danger.default};
		`,
		checkDetail: css`
			color: ${token.magicColorUsages.primary.default};
			cursor: pointer;
		`,
	}
})
