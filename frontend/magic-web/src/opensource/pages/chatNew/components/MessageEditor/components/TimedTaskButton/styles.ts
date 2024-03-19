import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, prefixCls }) => {
	return {
		popover: css`
			.${prefixCls}-popover-inner {
				width: 320px;
				padding: 20px;
				border-radius: 8px;
			}
		`,
	}
})
