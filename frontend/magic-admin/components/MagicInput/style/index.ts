import { createStyles } from "antd-style"

export const useStyles = createStyles(({ prefixCls, token, css }) => {
	return {
		magicInput: css`
			border-radius: 8px;
			.${prefixCls}-input-group .${prefixCls}-input-group-addon {
				&:first-child {
					background-color: transparent;
					font-weight: 600;
					font-size: 14px;
					color: ${token.magicColorUsages.text[3]};
				}
				&:last-child {
					border-left: none;
					padding-left: 0;
				}
			}
		`,
	}
})
