import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token, prefixCls }) => {
	return {
		header: css`
			width: 100%;
			padding: 10px 16px;
			display: flex;
			align-items: center;
			justify-content: space-between;
			border-bottom: 1px solid ${token.magicColorUsages.border};
		`,
		title: css`
			font-size: 16px;
			line-height: 22px;
			font-weight: 600;
			color: ${token.magicColorUsages.text[0]};
		`,
		close: css`
			display: flex;
			align-items: center;
			justify-content: center;
		`,
		section: css`
			width: 100%;
			padding: 0 20px;
			flex: none;

			@media (max-width: 768px) {
				padding: 10px;
			}
		`,
		tip: css`
			width: 100%;
			flex: none;
			padding: 14px 20px;
			margin-bottom: 20px;
			display: flex;
			flex-direction: column;
			gap: 10px;
			border-radius: 8px;
			border: 1px solid ${token.magicColorUsages.border};
			background-color: ${token.magicColorScales.grey[0]};

			@media (max-width: 768px) {
				padding: 10px;
				margin-bottom: 10px;
			}
		`,
		tipTitle: css`
			color: ${token.magicColorUsages.text[1]};
			font-size: 16px;
			font-style: normal;
			font-weight: 600;
			line-height: 22px; /* 137.5% */

			@media (max-width: 768px) {
				font-size: 14px;
				line-height: 20px;
			}
		`,
		titleDesc: css`
			color: ${token.magicColorUsages.text[3]};
			font-size: 14px;
			font-style: normal;
			font-weight: 400;
			line-height: 20px; /* 142.857% */

			@media (max-width: 768px) {
				font-size: 10px;
				line-height: 13px;
			}
		`,
		divider: css`
			margin: 0 !important;
		`,
		tag: css`
			padding: 6px 4px;
			display: inline-flex;
			align-items: center;
			gap: 4px;
			color: ${token.magicColorUsages.text[1]};
			font-size: 14px;
			font-style: normal;
			font-weight: 400;
			line-height: 20px; /* 142.857% */

			@media (max-width: 768px) {
				font-size: 12px;
				line-height: 16px;
			}
		`,
		handlerButton: css`
			display: flex;
			padding: 6px 4px 6px 10px;
			align-items: center;
			gap: 4px;
			border-radius: 8px;
			background-color: ${token.magicColorUsages.primaryLight.default};
			color: ${token.magicColorUsages.primary.default};
			font-size: 14px;
			font-style: normal;
			font-weight: 600;
			line-height: 20px; /* 142.857% */
			cursor: pointer;
			transition: all linear 0.1s;

			&:hover {
				background-color: ${token.magicColorUsages.primaryLight.hover};
			}

			&:active {
				background-color: ${token.magicColorUsages.primaryLight.active};
			}

			@media (max-width: 768px) {
				font-size: 12px;
				line-height: 16px;
			}
		`,
		wrapper: css`
			width: 100%;
			margin-bottom: 10px;
			display: flex;
			align-items: center;
			justify-content: space-between;
			flex: none;

			@media (max-width: 768px) {
				margin-bottom: 0;
			}
		`,
		wrapperTitle: css`
			color: ${token.magicColorUsages.text[1]};
			font-size: 16px;
			font-style: normal;
			font-weight: 600;
			line-height: 22px; /* 137.5% */
		`,
		wrapperDesc: css`
			color: ${token.magicColorUsages.text[3]};
			font-size: 12px;
			font-style: normal;
			font-weight: 400;
			line-height: 16px; /* 133.333% */
		`,
		addMemory: css`
			display: flex;
			padding: 6px 12px;
			align-items: center;
			gap: 4px;
			border-radius: 8px;
			background-color: ${token.magicColorUsages.primary.default};
			color: #fff;
			font-size: 14px;
			line-height: 20px; /* 142.857% */
			cursor: pointer;

			&:hover {
				font-weight: 600;
			}
		`,

		body: css`
			padding: 0 0 20px 20px;
			flex-basis: auto;
			overflow: hidden;
			width: 100%;
			height: 100%;

			@media (max-width: 768px) {
				padding: 0 10px 10px 10px;
			}
		`,

		tabs: css`
			.${prefixCls}-tabs-tab + .${prefixCls}-tabs-tab {
				margin: 0 0 0 20px !important;
			}

			.${prefixCls}-tabs-tab-active {
				font-weight: 600;
			}

			@media (max-width: 768px) {
				.${prefixCls}-tabs-nav-list {
					width: 100%;
				}

				.${prefixCls}-tabs-tab {
					flex: 1;
					display: flex;
					justify-content: center;
					align-items: center;
					font-size: 16px;
					line-height: 22px;
					font-weight: 600;
					color: ${token.magicColorUsages.text[2]};
				}
			}
		`,

		mobileFooter: css`
			padding: 10px;
			border-top: 1px solid ${token.magicColorUsages.border};
		`,
		mobileFooterBtn: css`
			width: 100%;
			height: 40px;
			display: flex;
			justify-content: center;
			align-items: center;
			gap: 4px;
			font-size: 14px;
			border-radius: 8px;
			border: none;
		`,
	}
})
