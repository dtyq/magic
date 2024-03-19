import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, isDarkMode, prefixCls, token }) => {
	const backgroundColor = isDarkMode
		? token.magicColorScales.grey[0]
		: token.magicColorScales.white

	return {
		popover: css`
			.${prefixCls}-popover-inner {
				padding: 0;
				width: fit-content;
				min-width: 200px;
				border-radius: 12px;
				margin-bottom: 12px;
				margin-left: 4px;
			}

			.${prefixCls}-popover-inner-content {
				display: flex;
				flex-direction: column;
				gap: 4px;
			}

			.${prefixCls}-btn {
				width: 100%;
				font-size: 14px;
				padding-left: 8px;
				padding-right: 8px;
			}
		`,
		menuWrapper: css`
			.${prefixCls}-menu-item-selected.${prefixCls}-menu-item-selected {
				--${prefixCls}-menu-item-selected-bg: transparent;
				--${prefixCls}-menu-item-selected-color: var(--${prefixCls}-menu-item-color);
			}
		`,
		menu: css`
			background-color: transparent;
			--${prefixCls}-menu-active-bar-border-width: 0 !important;
			max-height: 80vh;

			display: flex;
			flex-direction: column;
			gap: 4px;
			overflow-y: auto;
			align-items: center;


			.${prefixCls}-menu-item {
				gap: 4px;
				font-size: 14px;
				font-style: normal;
				font-weight: 400;
				line-height: 20px;
				padding: 6px;
				height: 52px;
				margin: 0;
				flex-shrink: 0;

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
		avatar: css`
			color: white !important;
			border: 1px solid ${token.magicColorUsages.border};
		`,
		popoverContent: css`
			width: 300px;
			max-width: 90vw;
			flex-direction: column;
			align-items: flex-start;
			gap: 10px;
			background-color: ${backgroundColor};
			box-shadow:
				0 4px 14px 0 rgba(0, 0, 0, 0.1),
				0 0 1px 0 rgba(0, 0, 0, 0.3);
			border-radius: 8px;
		`,
	}
})

export const useOrganizationListStyles = createStyles(({ isDarkMode, css, token, prefixCls }) => {
	const backgroundColor = isDarkMode
		? token.magicColorScales.grey[0]
		: token.magicColorScales.white
	return {
		containerWrapper: css`
			width: 100%;
			height: 100%;
			padding: 10px;
			overflow: hidden;
		`,
		container: css`
			display: flex;
			width: 100%;
			flex-direction: column;
			align-items: flex-start;
			gap: 10px;
			height: fit-content;
			max-height: 50vh;
			overflow-y: auto;

			/* Custom scrollbar for virtuoso content */
			&::-webkit-scrollbar {
				width: 6px;
			}

			&::-webkit-scrollbar-thumb {
				background: ${token.magicColorUsages.border};
				border-radius: 4px;
			}

			&::-webkit-scrollbar-track {
				background: transparent;
			}
		`,
		group: css`
			width: 100%;
			padding: 10px 12px;
			border-radius: 8px;
			border: 1px solid ${token.magicColorUsages.border};
			display: flex;
			flex-direction: column;
			gap: 10px;

			&:last-child {
				margin-bottom: 0;
			}
		`,
		groupHeader: css`
			position: relative;
			background-color: ${backgroundColor};

			&:before {
				content: "";
				position: absolute;
				left: 0;
				bottom: -10px;
				width: 100%;
				height: 10px;
				background: radial-gradient(circle at top, white, transparent);
			}
		`,
		groupSection: css`
			display: flex;
			padding: 4px 8px;
			align-items: center;
			gap: 10px;
			color: ${token.magicColorUsages.text[3]};
			font-size: 12px;
			font-style: normal;
			font-weight: 400;
			line-height: 16px;
			border: 1px solid ${token.magicColorUsages.border};
			border-radius: 4px;
			height: 24px;
		`,
		groupHeaderLine: css`
			width: 10px;
			flex: auto;
			height: 1px;
			background-color: ${token.magicColorUsages.border};
		`,
		groupWrapper: css`
			width: 100%;
			display: flex;
			justify-content: space-between;
			align-items: center;
			align-self: stretch;
			gap: 8px;
		`,
		groupIcon: css`
			width: 40px;
			height: 40px;
			flex: none;
			padding: 2px;
			justify-content: center;
			align-items: center;
			gap: 10px;
			overflow: hidden;
		`,
		groupTitle: css`
			flex: 1;
			margin-right: auto;
			color: ${token.magicColorUsages.text[1]};
			font-size: 14px;
			font-style: normal;
			font-weight: 400;
			line-height: 20px;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		`,
		groupLogout: css`
			--${prefixCls}-button-padding-inline: 0 !important;
			--${prefixCls}-control-height: 24px !important;
			color: ${token.magicColorUsages.primary};
			font-size: 14px;
			font-style: normal;
			font-weight: 400;
			line-height: 20px;
		`,
		groupDesc: css`
			color: ${token.magicColorUsages.text[3]};
			font-style: normal;
			font-weight: 400;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
			font-size: 12px;
			font-style: normal;
			font-weight: 400;
			line-height: 16px;
		`,
		avatar: css`
			color: white !important;
			border: 1px solid ${token.magicColorUsages.border};
		`,
		avatarDisabled: css`
			filter: grayscale(100%);
		`,
		button: css`
			flex: none;
			display: flex;
			width: 100%;
			margin: 10px auto 0 0;
			height: 32px;
			padding: 6px 12px;
			justify-content: center;
			align-items: center;
			align-self: stretch;
			border-radius: 8px;
			border: 0 solid rgba(0, 0, 0, 0);
			cursor: pointer;
			background: ${token.magicColorUsages.fill[0]};

			&:hover {
				background: ${token.magicColorUsages.fill[1]};
			}

			&:active {
				background: ${token.magicColorUsages.fill[2]};
			}
		`,
	}
})
