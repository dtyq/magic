import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, prefixCls }) => {
	return {
		form: css`
			width: 100%;
			.${prefixCls}-form-item {
				margin-bottom: 0;
			}
		`,
		toolSelect: css``,
	}
})
