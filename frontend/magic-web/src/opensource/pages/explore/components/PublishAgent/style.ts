import { createStyles } from "antd-style"

export const useStyles = createStyles(
	({ prefixCls, token, css, isDarkMode }, { success }: { success: boolean }) => {
		return {
			modal: css`
				.${prefixCls}-modal-footer {
					border-top: none;
					padding-top: 0;
					padding: ${success && "0"};
				}
				.${prefixCls}-modal-body {
					padding: 10px;
				}
			`,
			form: css`
				.${prefixCls}-form-item {
					margin-bottom: 8px;
				}
			`,
			title: css`
				font-size: 14px;
				font-weight: 600;
				color: ${isDarkMode
					? token.magicColorScales.grey[1]
					: token.magicColorUsages.text[1]};
				margin-bottom: 8px;
			`,
			radioBox: css`
				display: flex;
				justify-content: space-between;
				gap: 10px;

				.${prefixCls}-radio-wrapper {
					margin: 0;
					flex: 1;
					span {
						padding: 0;
						flex: 1;
					}
				}
				.${prefixCls}-radio {
					display: none !important;
				}
			`,
			customRadio: css`
				flex: 1;
				padding: 14px 0;
				border: 1px solid ${token.colorBorder};
				border-radius: 12px;
				font-size: 12px;
				position: relative;
				color: ${isDarkMode
					? token.magicColorScales.grey[4]
					: token.magicColorUsages.text[3]};
			`,
			checked: css`
				border-width: 2px;
				border-color: ${isDarkMode
					? token.magicColorScales.brand[5]
					: token.magicColorScales.brand[5]};
			`,
			customRadioTitle: css`
				font-size: 14px;
				line-height: 20px;
				color: ${isDarkMode
					? token.magicColorScales.grey[1]
					: token.magicColorUsages.text[1]};
			`,
			disabled: css`
				color: ${isDarkMode
					? token.magicColorScales.grey[4]
					: token.magicColorUsages.text[3]} !important;
			`,
			disabledText: css`
				position: absolute;
				top: 10px;
				right: 10px;
				border-radius: 3px;
				padding: 2px 8px;
				font-size: 12px;
				background-color: ${isDarkMode
					? token.magicColorScales.grey[2]
					: token.magicColorScales.grey[2]};
				color: ${isDarkMode
					? token.magicColorScales.grey[1]
					: token.magicColorUsages.white};
			`,
			checkedIcon: css`
				position: absolute;
				right: -2px;
				top: -2px;
				background-color: ${isDarkMode
					? token.magicColorScales.brand[5]
					: token.magicColorScales.brand[5]};
				border-radius: 0 12px 0 12px;
				display: flex;
				align-items: center;
				justify-content: center;
				width: 32px;
				height: 32px;
			`,
			alert: css`
				border: 0;
				background: ${isDarkMode
					? token.magicColorScales.orange[0]
					: token.magicColorScales.orange[0]};
				.magic-alert-message {
					color: ${token.magicColorUsages.warning.default}!important;
				}
			`,
			aiButton: css`
				height: 24px;
				width: 24px !important;
				border-radius: 4px;
				padding: 0;
				background-color: ${isDarkMode
					? token.magicColorScales.grey[2]
					: token.magicColorUsages.fill[0]};
				margin-bottom: 6px;
				border: 0px;
			`,
		}
	},
)
