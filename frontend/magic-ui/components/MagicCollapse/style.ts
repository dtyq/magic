import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, prefixCls, token }) => {
	return {
		container: css`
			--${prefixCls}-collapse-content-bg: ${token.colorBgContainer} !important;
			
			.${prefixCls}-collapse-item {
				transition: all 0.35s cubic-bezier(0.215, 0.61, 0.355, 1);
			}
			
			.${prefixCls}-collapse-header {
				transition: all 0.35s cubic-bezier(0.215, 0.61, 0.355, 1) !important;
			}
			
			.${prefixCls}-collapse-content {
				transition: all 0.35s cubic-bezier(0.215, 0.61, 0.355, 1) !important;
			}
		`,
	}
})
