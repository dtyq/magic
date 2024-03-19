import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, prefixCls }) => ({
	drawer: css`
		.${prefixCls}-drawer-header {
			padding: 10px;
		},
		.${prefixCls}-drawer-body {
			padding: 16px;
		},
	`,
}))
