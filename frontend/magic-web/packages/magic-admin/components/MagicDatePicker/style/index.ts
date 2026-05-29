import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token, prefixCls }) => ({
	datePicker: css`
		width: 100%;
	`,
	datePickerRangePicker: css`
		width: 100%;
		.${prefixCls}-picker-prefix {
			color: ${token.magicColorUsages.text[3]};
			margin-inline-end: 8px;
		}
		.${prefixCls}-picker-input {
			padding: 0 9px;
		}
		.${prefixCls}-picker-range-separator {
			color: ${token.magicColorUsages.text[3]};
		}
		.${prefixCls}-picker-suffix {
			color: ${token.magicColorUsages.text[2]};
		}
	`,
}))
