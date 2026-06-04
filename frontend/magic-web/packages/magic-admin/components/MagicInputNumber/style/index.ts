import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, prefixCls, token }) => {
	return {
		magicInputNumber: css`
			border-radius: 8px;

			.${prefixCls}-input-number-group {
				.${prefixCls}-input-number-group-addon {
					background-color: white;
					color: ${token.magicColorUsages.text[2]};
					font-weight: 600;
					font-size: 14px;
				}

				// 当input-number前面有group-addon时，左边框宽度为0
				.${prefixCls}-input-number-group-addon + .${prefixCls}-input-number {
					border-left-width: 0;
					&:hover,
					&.${prefixCls}-input-number-focused {
						border-left-width: 1px !important;
					}
				}

				// 当input-number后面有group-addon时，右边框宽度为0
				.${prefixCls}-input-number:has(+ .${prefixCls}-input-number-group-addon) {
					border-right-width: 0;
					&:hover,
					&.${prefixCls}-input-number-focused {
						border-right-width: 1px;
					}
				}
			}
		`,
	}
})
