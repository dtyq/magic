import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, prefixCls, isDarkMode, token }) => {
	return {
		dropdown: css`
			--${prefixCls}-border-radius-lg: 10px;

			.${prefixCls}-dropdown-menu-item,
			.${prefixCls}-dropdown-menu-submenu-title {

				.${prefixCls}-dropdown-menu-item-icon {
					margin-inline-end: 0;
				}

				gap: 4px;
				--${prefixCls}-control-padding-horizontal: 8px;
				--${prefixCls}-dropdown-padding-block: 10px;
				--${prefixCls}-border-radius-sm: 10px;
				--${prefixCls}-control-item-bg-hover: ${token.magicColorUsages.primaryLight.default};
			}


			.${prefixCls}-dropdown-menu-item-danger {
				color: ${
					isDarkMode
						? token.magicColorUsages.danger.default
						: token.magicColorUsages.danger.default
				} !important;
				--${prefixCls}-color-error: ${
			isDarkMode ? token.magicColorUsages.danger.default : token.magicColorScales.red[0]
		};

			&:hover {
				color: ${
					isDarkMode
						? token.magicColorUsages.white
						: token.magicColorUsages.danger.default
				} !important;
				background-color: ${
					isDarkMode
						? token.magicColorUsages.danger.default
						: token.magicColorScales.red[0]
				} !important;
			}
		}
		`,
		subMenu: css`
			.${prefixCls}-dropdown-menu-sub {
				transform: translateX(8px);
			}
		`,
	}
})
