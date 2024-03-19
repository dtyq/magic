import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, prefixCls }) => {
	return {
		modal: css`
			.magic-flow-content {
				height: 100% !important;
			}
			.magic-flow-panel-material-list {
				height: calc(100vh - 190px) !important;
			}
			.${prefixCls}-modal-body {
				border-radius: 0 0 8px 8px !important;
			}
		`,
	}
})
