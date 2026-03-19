import { createStyles } from "antd-style"

export default createStyles(({ prefixCls, css, token }) => ({
	buttonGroup: css`
		border: 1px solid ${token.magicColorUsages.border};
		border-radius: 4px;
	`,
	button: css`
		width: 14px !important;
		height: 14px;
		padding: 0;
		&:hover {
			border-radius: 0;
		}
	`,
	inputNumber: css`
		width: 56px;
		.${prefixCls}-input-number-handler-wrap {
			display: none;
		}
	`,
}))
