import { createStyles } from "antd-style"

export const useStyles = createStyles(({ prefixCls, css, isDarkMode, token }) => {
	return {
		drawer: css`
			padding: 0;
			&.${prefixCls}-drawer-content {
				background: ${token.magicColorScales.grey[0]};
			}
			.${prefixCls}-drawer-header {
				padding: 12px 20px 0px 20px;
				border-bottom: 0;
				align-items: center;
			}
			.${prefixCls}-drawer-body {
				padding: 12px 20px;
				// padding-top: 0;
			}
			.${prefixCls}-drawer-footer {
				padding: 12px 20px;
				display: flex;
				flex-direction: row;
				justify-content: flex-end;
			}
		`,
		isEmptyDrawer: css`
			.${prefixCls}-drawer-body {
				display: flex;
				align-items: center;
				justify-content: center;
			}
		`,
		title: css`
			padding: 12px 0;
		`,
		topTitle: css`
			font-size: 16px;
			font-weight: 600;
			line-height: 22px;
			color: ${token.magicColorUsages.text[1]};
		`,

		formSubTitle: css`
			font-size: 14px;
			font-weight: 600;
			line-height: 20px;
			color: ${token.magicColorUsages.text[1]};
		`,
		desc: css`
			font-size: 12px;
			font-weight: 400;
			line-height: 16px;
			color: ${token.magicColorUsages.text[3]};
		`,
		pointer: css`
			cursor: pointer;
		`,
		form: css`
			display: flex;
			flex-direction: column;
			gap: 10px;
			// padding-top: 12px;
			.${prefixCls}-form-item {
				margin-bottom: 0px;
				.${prefixCls}-form-item-label {
					padding-bottom: 6px;
					label {
						font-size: 12px;
						font-weight: 400;
						line-height: 16px;
						color: ${token.magicColorUsages.text[1]};
					}
				}
			}
			.${prefixCls}-form-item-required {
				&::before {
					content: "" !important; /* 隐藏原有的星号 */
					display: none !important;
				}
				&::after {
					content: "*" !important;
					color: ${token.magicColorUsages.danger.default};
					padding-left: 4px;
					visibility: visible !important;
				}
			}
		`,
		formItem: css`
			.${prefixCls}-form-item-control-input-content {
				flex: 1;
				display: flex;
				gap: 4px;
			}
		`,
		radioGroup: css`
			display: flex;
			flex-direction: column;
			gap: 10px;
		`,
		specialRadioGroup: css`
			label {
				.${prefixCls}-radio {
					align-self: flex-start;
					top: 4px;
				}
			}
		`,
		optionText: css`
			flex: 1;
			font-size: 12px;
			color: ${isDarkMode ? token.magicColorScales.grey[4] : token.magicColorUsages.text[2]};
		`,
		optionShortText: css`
			flex: 0 1 8%;
		`,
		labelText: css`
			font-size: 12px;
			font-weight: 400;
			color: ${isDarkMode ? token.magicColorScales.grey[3] : token.magicColorUsages.text[1]};
			align-self: center;
		`,
		required: css`
			min-width: 80px;
			&::after {
				content: "*";
				color: ${token.magicColorUsages.danger.default};
				padding-left: 4px;
				visibility: visible;
			}
		`,
		input: css`
			color: ${token.magicColorUsages.text[0]};
			background-color: ${isDarkMode
				? token.magicColorScales.grey[0]
				: token.magicColorUsages.white};
			&::placeholder {
				color: ${isDarkMode
					? token.magicColorUsages.white
					: token.magicColorUsages.text[3]};
			}
		`,
		select: css`
			.${prefixCls}-select-selector.${prefixCls}-select-selector {
				background-color: ${isDarkMode
					? token.magicColorUsages.fill[0]
					: token.magicColorUsages.white};
				.${prefixCls}-select-selection-item {
					color: ${token.magicColorUsages.text[0]};
				}
			}
		`,
		optionIcon: css`
			display: inline-flex;
			justify-content: center;
			width: 24px;
			position: relative;
			top: 2px;
		`,
		dropdown: css`
			.${prefixCls}-select-item-option {
				padding: 8px 12px;
			}
		`,
		button: css`
			padding: 6px 12px;
			border: 0;
			border-radius: 8px;
			background-color: ${token.magicColorUsages.fill[0]};
			color: ${token.magicColorUsages.text[1]};
		`,
		iconOuterButton: css`
			color: ${token.magicColorUsages.text[2]};
			background-color: ${isDarkMode
				? token.magicColorScales.grey[0]
				: token.magicColorUsages.white};
		`,
		iconPopover: css`
			.${prefixCls}-popover-inner {
				background-color: ${isDarkMode
					? token.magicColorUsages.bg[3]
					: token.magicColorUsages.white};
			}
		`,
		iconGrid: css`
			display: grid;
			gap: 10px;
			grid-template-columns: repeat(6, 1fr);
		`,
		iconButton: css`
			border-radius: 8px;
			border: 1px solid ${token.magicColorUsages.border};
			background-color: ${isDarkMode
				? token.magicColorUsages.bg[0]
				: token.magicColorUsages.white};
		`,
		iconWrapper: css`
			display: grid;
			gap: 10px;
			grid-template-columns: repeat(6, 1fr);
		`,
		selectedIconButton: css`
			color: ${token.magicColorUsages.primary.default} !important;
			border: 1px solid ${token.magicColorUsages.primary.default};
			background-color: ${token.magicColorUsages.primaryLight.default};
		`,
		atButton: css`
			font-size: 12px;
			height: 24px;
			border-radius: 4px;
			background-color: ${isDarkMode ? "transparent" : token.magicColorUsages.white};
			border: 1px solid ${token.magicColorUsages.border};
			padding: 0 6px;
			gap: 2px;
			color: ${token.magicColorUsages.text[1]};
		`,
		btn: css`
			font-weight: 400;
			color: ${isDarkMode ? token.magicColorScales.grey[1] : token.magicColorUsages.text[1]};
			border-radius: 8px;
			border-color: #1c1d2314;
			font-weight: 400;
		`,
		commonIcon2: css`
			color: ${token.magicColorUsages.text[2]};
			align-self: center;
		`,
		commonIcon: css`
			color: ${token.magicColorUsages.text[1]};
		`,
		editor: css`
			border-radius: 8px;
			border: 1px solid ${token.magicColorUsages.border};
			height: fit-content;
			min-height: 100px;
			max-height: 200px;
			overflow-y: auto;
			padding: 5px 12px;
			background-color: ${isDarkMode
				? token.magicColorScales.grey[0]
				: token.magicColorUsages.white};
			p[data-placeholder] {
				color: ${token.magicColorUsages.text[3]};
			}
		`,
		switch: css`
			width: 40px;
			height: 24px;
			background-color: ${token.magicColorUsages.fill[0]};
			.${prefixCls}-switch-handle {
				top: 3px;
				left: 3px;
				&::before {
					width: 18px;
					height: 18px;
					box-shadow:
						0px 0px 1px 0px rgba(0, 0, 0, 0.3),
						0px 4px 6px 0px rgba(0, 0, 0, 0.1);
					border: 1px solid ${token.magicColorUsages.border};
				}
			}
			&.${prefixCls}-switch:hover:not(.${prefixCls}-switch-checked) {
				background-color: ${token.magicColorScales.grey[1]};
			}
		`,
	}
})
