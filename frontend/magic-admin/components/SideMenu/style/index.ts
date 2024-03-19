import { createStyles } from "antd-style"

export const useStyles = createStyles(
	({ css, token, prefixCls }, { collapsed }: { collapsed: boolean }) => {
		return {
			side: css`
				width: ${collapsed ? "56px" : "200px"};
				height: 100%;
				flex: none;
				display: flex;
				flex-direction: column;
				justify-content: space-between;
				align-items: space-between;
				border-right: 1px solid #1c1d2314;
				padding: 10px;
				transition: width 0.2s ease-in-out;
				@keyframes stroke {
					0% {
						stroke-dashoffset: 100;
					}
					100% {
						stroke-dashoffset: 0;
					}
				}
			`,
			menu: css`
				--${prefixCls}-menu-item-selected-bg: ${token.magicColorUsages.primaryLight.default} !important;

				--${prefixCls}-menu-sub-menu-item-bg: transparent !important;
				
				background: transparent;
				border-inline-end: none !important;
				width: 100%;

				&::before {
					display: none;
				}

				.${prefixCls}-menu-item {
					width: 100%;
					height: 40px;
					padding: 10px !important;
					margin: 0 0 4px;
					font-size: 14px;
					color: ${token.magicColorUsages.text[1]};
					.${prefixCls}-menu-item-icon +span {
						margin-inline-start: 4px;
					}
					.${prefixCls}-menu-title-content {
						margin-left: 4px;
					}
					&.${prefixCls}-menu-item-selected {
						font-weight: 500;
						color: ${token.magicColorUsages.primary.default};
					}
				}

				.${prefixCls}-menu-submenu {
					margin-bottom: 12px;
					.${prefixCls}-menu-submenu-title {
						display: flex;
						justify-content: space-between;
						padding: 0 !important;
						height: 20px;
						border-radius: 0;
						margin: 0;
						color: ${token.magicColorUsages.text[2]};
						&:hover {
							background: transparent;
						}
					}
					.${prefixCls}-menu-item {
						margin: 4px 0 0;
					}
				}
			`,
			divider: css`
				width: 100%;
				margin: 4px auto;
			`,
			collapseWrapper: css`
				width: 100%;
			`,
			collapse: css`
				margin: 0;
				gap: 0;
			`,
		}
	},
)
