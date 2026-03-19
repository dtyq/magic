import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, isDarkMode, prefixCls, token }) => {
	return {
		bordered: css`
			box-shadow:
				0 0 1px 0 rgba(0, 0, 0, 0.3),
				0 4px 14px 0 rgba(0, 0, 0, 0.1);
		`,
		logo: css`
			width: 100%;
		`,
		privateForm: css`
			width: 100%;
			display: flex;
			flex-direction: column;
			gap: 20px;
		`,
		form: css`
			width: 100%;

			.${prefixCls}-btn:not(.${prefixCls}-btn-link) {
				font-size: 14px;
				font-weight: 600;
				line-height: 20px;

				--${prefixCls}-button-border-color-disabled: transparent;
			}
		`,
		formItem: css`
			--${prefixCls}-form-item-margin-bottom: 0 !important;

			.${prefixCls}-input,
			.${prefixCls}-input-password {
				--${prefixCls}-input-padding-block: 8px;
				--${prefixCls}-input-padding-inline: 8px;
				padding-left: 16px;
				color: ${isDarkMode ? token.magicColorScales.grey[6] : token.magicColorUsages.text[0]};
				font-size: 14px;
				font-weight: 400;
				line-height: 22px;
			}

			.${prefixCls}-input-password-icon {
				color: ${isDarkMode ? token.magicColorScales.grey[6] : token.magicColorUsages.text[1]};
			}
		`,
		phoneInput: css`
			.magic-input-group {
				display: flex;
				align-items: center;
				gap: 5px;

				.${prefixCls}-input-group-addon {
					flex-shrink: 0;
					display: flex;
					align-items: center;
					justify-content: center;
					width: fit-content;
					height: 40px;
					padding: 0;
					border: 1px solid ${token.magicColorUsages.border};
				}

				.${prefixCls}-input-group-addon, .${prefixCls}-input {
					border-radius: 8px;
					background-color: ${token.magicColorUsages.bg[0]};
				}
			}
		`,
		options: css`
			margin-top: 8px;
			display: flex;
			align-items: center;
			justify-content: flex-end;

			.${prefixCls}-btn {
				padding: 0;
			}

			width: 100%;
		`,
		login: css`
			padding: 10px 16px;
			height: fit-content;
		`,
		readAndAgree: css`
			span,
			a {
				color: ${isDarkMode
					? token.magicColorScales.grey[4]
					: token.magicColorUsages.text[1]};
				font-weight: 400;
				line-height: 16px;
			}
		`,
		underline: css`
			text-decoration: underline;
			text-underline-offset: 3px;
		`,
		autoRegisterTip: css`
			color: ${isDarkMode ? token.magicColorScales.grey[5] : token.magicColorUsages.text[3]};
			font-weight: 400;
			line-height: 20px;
		`,
		register: css`
			.${prefixCls}-btn {
				padding: 0;
			}

			color: ${isDarkMode ? token.magicColorUsages.white : token.magicColorUsages.text[1]};
		`,
		footer: css`
			margin-top: 24px;
		`,
	}
})
