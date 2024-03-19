import { createStyles } from "antd-style"

export const useStyles = createStyles(({ isDarkMode, prefixCls, css, token }) => {
	return {
		form: css`
			display: flex;
			flex-direction: column;
			gap: 20px;
		`,
		required: css`
			label {
				&::after {
					content: "*" !important;
					color: ${token.magicColorUsages.danger.default};
				}
			}
		`,
		formItem: css`
			margin-bottom: 0;
			.${prefixCls}-form-item-label {
				width: 160px;
				text-align: start;
				color: ${token.magicColorUsages.text[1]};
				label {
					text-wrap-mode: wrap;
				}
			}
		`,

		checkboxGroup: css`
			display: flex;
			flex-direction: column;
			gap: 20px;
			.${prefixCls}-checkbox-wrapper {
				display: flex;
			}
			.${prefixCls}-checkbox {
				align-self: flex-start;
				margin-top: 2px;
			}
		`,
		icon: css`
			border-radius: 4px;
			background-color: ${token.magicColorUsages.bg[0]};
			border: 1px solid ${token.magicColorUsages.border};
			color: ${token.magicColorUsages.text[2]};
			padding: 2px 6px;
			display: flex;
			align-items: center;
			justify-content: center;
		`,
		text0: css`
			font-size: 14px;
			color: ${token.magicColorUsages.text[0]};
		`,
		desc: css`
			font-size: 14px;
			color: ${token.magicColorUsages.text[3]};
		`,
		smallDesc: css`
			font-size: 12px;
			color: ${token.magicColorUsages.text[3]};
			padding-left: 24px;
		`,
		searchGroup: css`
			flex: 1;
			display: flex;
			align-items: center;
			position: relative;
		`,
		search: css`
			font-size: 16px;
			height: 50px;
			width: 100%;
			color: ${isDarkMode ? token.magicColorScales.grey[4] : token.magicColorUsages.text[3]};
			background: transparent;

			.${prefixCls}-select-selector {
				border-radius: 50px;
				padding: 0 18px;
				box-shadow: 0px 4px 14px 0px rgba(0, 0, 0, 0.1), 0px 0px 1px 0px rgba(0, 0, 0, 0.3);
				.${prefixCls}-select-selection-search-input {
					padding-left: 36px !important;
				}
				.${prefixCls}-select-selection-placeholder {
					padding-left: 36px;
				}
				.${prefixCls}-select-selection-item {
					padding-inline-start: 36px;
					color: ${isDarkMode
						? token.magicColorScales.grey[4]
						: token.magicColorUsages.text[0]};
				}
			}
		`,
		searchIcon: css`
			position: absolute;
			z-index: 1;
			left: 18px;
		`,
		searchSuffix: {
			display: "flex",
			padding: "4px 8px",
			alignItems: "center",
			borderRadius: "100px",
			border: `1px solid ${token.colorBorder}`,
			backgroundColor: token.magicColorScales.grey[0],
		},
		searchPopup: css`
			border-radius: 12px;
			padding: 10px;
			max-height: 500px;
			overflow-y: auto;
			&::-webkit-scrollbar {
				width: 4px;
			}
			&::-webkit-scrollbar-button {
				// background-color: ${token.magicColorUsages.white};
			}
			&::-webkit-scrollbar-thumb {
				background: ${token.magicColorScales.grey[2]};
			}
		`,
		searchOption: css`
			border-radius: 8px;
			padding: 8px;
			&:hover {
				background-color: ${token.magicColorUsages.fill[0]};
			}
		`,
		tag: css`
			border: 1px solid ${token.magicColorScales.grey[2]} !important;
			background-color: ${token.magicColorUsages.bg[0]};
		`,
		officialModelConfig: css`
			padding: 20px;
			background-color: ${token.magicColorScales.grey[0]};
			border-radius: 12px;
			border: 1px solid ${token.magicColorUsages.border};
		`,
		title: css`
			font-size: 14px;
			font-weight: 600;
			color: ${token.magicColorUsages.text[1]};
		`,
		priceInput: css`
			.${prefixCls}-input-group {
				.${prefixCls}-input-group-addon {
					background-color: ${token.magicColorUsages.bg[0]};
					font-size: 14px;
					font-weight: 600;
					color: ${token.magicColorUsages.text[2]};
				}
				.${prefixCls}-input-outlined {
					border-left: none;

					&:not(:last-child) {
						border-right: none;
					}
					&:focus {
						border-left: 1px solid ${token.magicColorUsages.primary.default} !important;
						border-right: 1px solid ${token.magicColorUsages.primary.default};
					}
				}
			}
		`,
		inputNumber: css`
			width: 88%;
			.${prefixCls}-input-number-handler-wrap {
				background-color: ${token.magicColorUsages.bg[0]};
				border-radius: 3px;
				border: 1px solid ${token.magicColorUsages.border};
				opacity: 1 !important;
				width: 18px;
				right: -26px;
				.${prefixCls}-input-number-handler {
					border-left: none;
				}
			}
		`,
	}
})
