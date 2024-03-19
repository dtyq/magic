import { createStyles } from "antd-style"

const useStyles = createStyles(({ css, prefixCls }) => {
	return {
		popover: css`
			.${prefixCls}-popover-inner {
				padding: 4px;
				min-width: 180px;
				border-radius: 12px;
			}
			.${prefixCls}-popover-inner-content {
				display: flex;
				flex-direction: column;
				gap: 4px;
			}
			.${prefixCls}-btn {
				font-size: 14px;
				padding-left: 8px;
				padding-right: 8px;
			}
		`,
	}
})

export default useStyles
