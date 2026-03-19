import { createStyles } from "antd-style"

const useLoginFormOverrideStyles = createStyles(({ css, prefixCls, token }) => {
	return {
		container: css`
			.${prefixCls}-btn:not(.${prefixCls}-btn-link) {
				font-size: 14px;
				font-weight: 600;
				line-height: 20px;

				--${prefixCls}-button-border-color-disabled: transparent;

				&:disabled {
					background-color: ${token.magicColorUsages.disabled.bg};
				}
			}

			.${prefixCls}-form-item {
				--${prefixCls}-form-label-color: ${token.magicColorUsages.text[2]};

				.${prefixCls}-form-item-additional {
					margin-top: 10px;
				}

				.${prefixCls}-form-item-explain-error {
					text-align: left;
				}
			}
		`,
	}
})

export default useLoginFormOverrideStyles
