import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, isDarkMode, prefixCls, token }) => {
	return {
		menuWrapper: css`
			.${prefixCls}-menu-item-selected.${prefixCls}-menu-item-selected {
				--${prefixCls}-menu-item-selected-bg: transparent;
				--${prefixCls}-menu-item-selected-color: var(--${prefixCls}-menu-item-color);
			}
		`,
		menu: css`
			background-color: transparent;
			--${prefixCls}-menu-active-bar-border-width: 0 !important;


			.${prefixCls}-menu-item {
				gap: 4px;
				font-size: 14px;
				font-style: normal;
				font-weight: 400;

				&.${prefixCls}-menu-item-danger:hover {
					background-color: ${
						isDarkMode
							? token.magicColorUsages.danger.default
							: token.magicColorScales.red[0]
					} !important;
					color: ${isDarkMode ? token.magicColorUsages.white : token.magicColorUsages.danger} !important;
				}
			}

			.${prefixCls}-menu-submenu-title {
				--${prefixCls}-menu-item-selected-color: var(--${prefixCls}-menu-item-color);
				display: flex;
				align-items: center;
				gap: 4px;
				font-size: 14px;
				font-style: normal;
				font-weight: 400;
			}
		`,
	}
})
