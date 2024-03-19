import { memo } from "react"
import type { MenuProps } from "antd"
import { Menu } from "antd"
import { createStyles } from "antd-style"

const useStyles = createStyles(({ css, isDarkMode, prefixCls, token }) => {
	return {
		menuWrapper: css`
			border-radius: 12px;

			.${prefixCls}-menu-item-selected.${prefixCls}-menu-item-selected {
				--${prefixCls}-menu-item-selected-bg: transparent;

				&:hover {
					background-color: ${token.magicColorUsages.fill[0]};
				}

				--${prefixCls}-menu-item-selected-color: var(--${prefixCls}-menu-item-color);
			}

			.${prefixCls}-menu-item {
				--${prefixCls}-menu-item-height: 32px;
			}

			.${prefixCls}-menu-item-divider {
				width: auto;
				margin: 0 4px;
			}

		`,
		menu: css`
			--${prefixCls}-menu-active-bar-border-width: 0 !important;

			.${prefixCls}-menu-sub {
				border-radius: 12px;
			}

			.${prefixCls}-menu-item {
				gap: 4px;
				font-size: 14px;
				font-style: normal;
				font-weight: 400;
				line-height: 20px;
				background-color: white;

				&:not(.${prefixCls}-menu-item-danger) {
					color: ${token.magicColorUsages.text[1]};
				}

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
				padding: 0 8px;
				display: flex;
				align-items: center;
				gap: 4px;
				font-size: 14px;
				font-style: normal;
				font-weight: 400;
				line-height: 20px;
			}
		`,
	}
})

const MagicMenu = memo(function MagicMenu({ rootClassName, className, ...props }: MenuProps) {
	const { styles, cx } = useStyles()
	return (
		<Menu
			rootClassName={cx(styles.menuWrapper, rootClassName)}
			className={cx(styles.menu, className)}
			{...props}
		/>
	)
})

export default MagicMenu
