import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, prefixCls, token }) => ({
	tag: css`
		--${prefixCls}-tag-default-bg: ${token.magicColorUsages.fill[0]} !important;
		--${prefixCls}-color-border: transparent !important;
		--${prefixCls}-border-radius-sm: 8px;
		padding-inline: 4px;
		padding-block: 4px;
		display: flex;
		align-items: center;
		justify-content: center;

		> div {
			gap: 4px !important;

		}
	`,
}))
