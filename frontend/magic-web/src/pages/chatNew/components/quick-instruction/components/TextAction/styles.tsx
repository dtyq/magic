import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, prefixCls }) => {
	return {
		popover: css`
			.${prefixCls}-popover-inner {
				padding: 0;
				width: fit-content;
				min-width: 100px;
				border-radius: 12px;
			}
			.${prefixCls}-popover-inner-content {
				display: flex;
				flex-direction: column;
				gap: 4px;
			}
			.${prefixCls}-btn {
				width: 100%;
				font-size: 14px;
				padding-left: 8px;
				padding-right: 8px;
			}
		`,
	}
})
