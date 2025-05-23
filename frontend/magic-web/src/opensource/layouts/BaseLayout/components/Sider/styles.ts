import { createStyles } from "antd-style"

import { SupportLocales } from "@/const/locale"

export const useStyles = createStyles(
	(
		{ isDarkMode, css, token, prefixCls },
		{ collapsed, language }: { collapsed: boolean; language: string },
	) => {
		return {
			sider: css`
				box-sizing: border-box;
				border-right: 1px solid ${token.colorBorder};
				height: 100%;
				min-width: 56px;
				width: ${collapsed ? "56px" : "auto"};
				padding: 10px 10px;
				flex-shrink: 0;
				transition: width 0.2s ease-in-out;
				user-select: none;
				overflow: hidden;
				position: relative;

				&::after {
					content: "";
					position: absolute;
					top: 120px;
					left: 120px;
					width: 75vw;
					height: 75vh;
					transform: rotate(-165deg);
					border-radius: 933.343px;
					opacity: 0.5;
					background: conic-gradient(
						from 0deg at 50% 50%,
						#ff0080 0deg,
						#e0f 54.00000214576721deg,
						#00a6ff 105.83999991416931deg,
						#4797ff 161.99999570846558deg,
						#04f 251.99999570846558deg,
						#ff8000 306.00000858306885deg,
						#f0c 360deg
					);
					filter: blur(122.50128173828125px);
				}

				@keyframes stroke {
					0% {
						stroke-dashoffset: 100;
					}
					100% {
						stroke-dashoffset: 0;
					}
				}

				.${prefixCls}-menu-item:hover {
					.${prefixCls}-menu-item-icon {
						stroke-dasharray: 100;
						stroke-dashoffset: 100;
						animation: stroke 1.5s forwards;
					}
				}
			`,
			divider: css`
				width: 100%;
				margin: 10px auto;
			`,
			menus: css`
				width: 100%;

				> .${prefixCls}-menu:not(:first-child) {
					border-top: 1px solid ${token.colorBorder};
					padding-top: 5px;
					margin-top: 5px;
				}
			`,
			menu: css`
				--${prefixCls}-menu-item-selected-bg: ${token.magicColorUsages.primaryLight.default} !important;

				--${prefixCls}-menu-item-color: ${token.magicColorUsages.text[1]} !important;

				--${prefixCls}-menu-item-selected-color: ${isDarkMode ? token.colorPrimary : token.magicColorUsages.text[1]} !important;

				.${prefixCls}-menu-item-selected {
					color: ${isDarkMode ? token.colorPrimary : token.magicColorUsages.text[1]} !important;
				}

				background: transparent;
				border-inline-end: none !important;
				width: ${collapsed ? "100%" : "100%"};

				> .${prefixCls}-menu-item {
					width: 100%;
					height: 30px;
					margin-left: 0;
					margin-right: 0;
					padding: 0 6px;
					gap: 4px;
				}

				.${prefixCls}-menu-title-content {
					margin-left: 0 !important;
					font-size: ${language === SupportLocales.zhCN ? "14px" : "12px"};
				}
			`,
			icon: css`
				width: 30px;
				height: 30px;
				display: flex;
				align-items: center;
				justify-content: center;
				cursor: pointer;
				flex: none;
				background-color: ${token.magicColorUsages.fill[1]};
				border-radius: ${token.borderRadiusLG}px;

				&:hover {
					background-color: ${token.magicColorUsages.fill[0]};
				}

				&:active {
					background-color: ${token.magicColorUsages.fill[2]};
				}
			`,
			organizationSwitchWrapper: css`
				flex-direction: ${collapsed ? "column" : "row"};
			`,
		}
	},
)

export const useSideMenuStyle = createStyles(({ css }) => {
	return {
		navIcon: css`
			font-size: 18px;
			width: 18px;
			height: 18px;
		`,
	}
})
