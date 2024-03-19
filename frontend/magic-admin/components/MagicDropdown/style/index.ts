import { createStyles } from "antd-style"

export const useStyles = createStyles(({ prefixCls, token, css }) => {
	return {
		magicDropdown: css`
			.${prefixCls}-dropdown-menu {
				.${prefixCls}-dropdown-menu-item-danger {
					color: ${token.magicColorUsages.danger.default} !important;
					&:hover {
						background-color: ${token.magicColorUsages.dangerLight.default} !important;
						color: ${token.magicColorUsages.danger.default} !important;
					}
				}
			}
		`,
		subMenu: css`
			.${prefixCls}-dropdown-menu-item-danger {
				color: ${token.magicColorUsages.danger.default} !important;
				&:hover {
					background-color: ${token.magicColorUsages.dangerLight.default} !important;
					color: ${token.magicColorUsages.danger.default} !important;
				}
			}
		`,
		magicButton: css`
			.${prefixCls}-btn-compact-first-item {
				padding-left: 12px;
				padding-right: 12px;
				border-right: none;
				border-radius: 8px;
				--${prefixCls}-button-default-bg: ${token.magicColorUsages.bg[1]};
				--${prefixCls}-button-default-border-color: ${token.magicColorUsages.border};
				--${prefixCls}-button-default-color: ${token.magicColorUsages.text[1]};

				--${prefixCls}-button-default-active-bg: ${token.magicColorUsages.fill[1]};
				--${prefixCls}-button-default-active-color: ${token.magicColorUsages.text[1]};
				--${prefixCls}-button-default-active-border-color: ${token.magicColorUsages.border};

				--${prefixCls}-button-default-hover-bg: ${token.magicColorUsages.fill[0]};
				--${prefixCls}-button-default-hover-border-color: ${token.magicColorUsages.border};
				--${prefixCls}-button-default-hover-color: ${token.magicColorUsages.text[1]};
			}
			.${prefixCls}-btn-variant-outlined:not(:disabled):hover {
				border-color: ${token.magicColorUsages.border};
				background-color: ${token.magicColorUsages.fill[0]};
			}
			.${prefixCls}-btn-compact-last-item {
				border-left: none;
				border-radius: 8px; 
				--${prefixCls}-button-default-bg: ${token.magicColorUsages.bg[1]};
				--${prefixCls}-button-default-border-color: ${token.magicColorUsages.border};
				--${prefixCls}-button-default-color: ${token.magicColorUsages.text[1]};

				--${prefixCls}-button-default-active-bg: ${token.magicColorUsages.fill[1]};
				--${prefixCls}-button-default-active-color: ${token.magicColorUsages.text[1]};
				--${prefixCls}-button-default-active-border-color: ${token.magicColorUsages.border};

				--${prefixCls}-button-default-hover-bg: ${token.magicColorUsages.fill[0]};
				--${prefixCls}-button-default-hover-border-color: ${token.magicColorUsages.border};
				--${prefixCls}-button-default-hover-color: ${token.magicColorUsages.text[1]};
				&::before {
					display: none;
				}
			}
			.${prefixCls}-btn-icon {
				display: flex;
				align-items: center;
				justify-content: center;
			}
		`,
	}
})
