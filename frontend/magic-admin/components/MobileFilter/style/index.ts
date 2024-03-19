import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, prefixCls, css }) => ({
	filterButton: css`
		position: relative;
		display: flex;
		align-items: center;
		gap: 4;
	`,
	drawer: css`
		& .${prefixCls}-drawer-header {
			padding: 14px;
		},
		& .${prefixCls}-drawer-body {
			padding: 14px;
		},
		& .${prefixCls}-drawer-footer {
			padding: 12px 14px;
			border-top:  1px solid ${token.magicColorUsages.border};
		},
	`,
	filterContent: css`
		padding: 4px 0;
	`,
}))
