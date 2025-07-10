import { createStyles } from "antd-style"

export const useStyles = createStyles(({ prefixCls, token, css }) => {
	return {
		magicSwitch: css`
			background-color: ${token.magicColorUsages.fill[0]};
			.${prefixCls}-switch-handle {
				&::before {
					box-shadow: 0px 0px 1px 0px rgba(0, 0, 0, 0.3),
						0px 4px 6px 0px rgba(0, 0, 0, 0.1);
					border: 1px solid ${token.magicColorUsages.border};
				}
			}
			&:hover {
				background-color: ${token.magicColorScales.grey[1]} !important;
			}
			&.${prefixCls}-switch-loading {
				.${prefixCls}-switch-handle {
					&::before {
						background-color: transparent;
						border: none;
						box-shadow: none;
					}
					.${prefixCls}-switch-loading-icon {
						color: #fff;
					}
				}
			}
			&[disabled] {
				.${prefixCls}-switch-inner {
					background-color: #d3dffb;
				}
			}
			&[aria-checked="true"] {
				.${prefixCls}-switch-inner {
					background: #315cec;
				}
				&:hover {
					.${prefixCls}-switch-inner {
						background-color: #2447c8;
					}
				}
			}
		`,
	}
})
