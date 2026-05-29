import { createStyles } from "antd-style"

export const useStyles = createStyles(({ prefixCls, token, css }) => {
	return {
		magicSwitch: css`
			width: 40px;
			height: 24px;
			background-color: ${token.magicColorUsages.fill[0]};
			&.${prefixCls}-switch {
				--${prefixCls}-switch-track-min-width: 40px;
			}
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

			&.${prefixCls}-switch:not(.${prefixCls}-switch-checked) {
				&:hover:not(.${prefixCls}-switch-disabled) {
					background-color: ${token.magicColorScales.grey[1]};
				}
			}

			&.${prefixCls}-switch-checked {
				&:hover {
					background-color: ${token.magicColorUsages.primary.hover};
				}
			}

			&.${prefixCls}-switch-small {
				width: 26px;
				.${prefixCls}-switch-handle {
					top: 2px;
					left: 2px;
					&::before {
						width: 12px;
						height: 12px;
					}
				}
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
					background: ${token.magicColorUsages.primary.default};
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
