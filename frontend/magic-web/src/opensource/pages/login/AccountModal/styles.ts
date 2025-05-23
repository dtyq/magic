import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, prefixCls }) => {
	return {
		modal: css`
			.${prefixCls}-modal-content {
				--magic-modal-content-padding: 0px !important;
			}
		`,
		modalHeader: css`
			display: flex;
			align-items: center;
		`,
		modalContent: css`
			padding: 0 !important;
		`,
		modalMask: css`
			background-color: rgba(0, 0, 0, 0.8) !important;
		`,
		layout: css`
			width: 100%;
			height: 100%;
			padding: 20px 10px;
		`,
		header: css`
			width: 100%;
		`,
	}
})
