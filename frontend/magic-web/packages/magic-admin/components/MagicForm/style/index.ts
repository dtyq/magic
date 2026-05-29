import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css, prefixCls }) => {
	return {
		form: css`
			display: flex;
			flex-direction: column;
			gap: 20px;
			.${prefixCls}-form-item {
				margin-bottom: 0;
			}
		`,
		required: css`
			color: ${token.magicColorUsages.danger.default};
		`,
	}
})
