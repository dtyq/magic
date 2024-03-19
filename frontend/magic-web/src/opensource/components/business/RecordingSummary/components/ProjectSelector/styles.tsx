import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token, prefixCls }) => {
	return {
		titleWrapper: css`
			padding: 10px 16px;
		`,
		title: css`
			font-size: 16px;
			font-weight: 600;
		`,
		closeIcon: css`
			cursor: pointer;
		`,
		searchInput: css`
			.ant-input-affix-wrapper {
				border-radius: 8px;
				border-color: ${token.colorBorder};
			}
		`,

		header: css`
			--${prefixCls}-modal-header-border-bottom: none !important;
			--${prefixCls}-modal-header-padding: 20px !important;
		`,

		body: css`
			--${prefixCls}-modal-body-padding: 0 !important;
		`,

		content: css`
			.${prefixCls}-modal-close {
				transform: translateY(0);
			}
		`,

		footer: css`
			--${prefixCls}-modal-footer-border-top: none !important;
		`,
	}
})
