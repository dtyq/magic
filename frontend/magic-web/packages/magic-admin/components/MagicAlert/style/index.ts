import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css, prefixCls }) => ({
	magicAlert: css`
		padding: 10px 12px;
		border: none;
		font-size: 12px;
		line-height: 16px;
		.${prefixCls}-alert-icon {
			margin-inline-end: 4px;
		}
		&.${prefixCls}-alert-success {
			background-color: ${token.magicColorUsages.successLight.default};
		}
		&.${prefixCls}-alert-error {
			color: ${token.magicColorUsages.danger.default};
			background-color: ${token.magicColorUsages.dangerLight.default};
			& .${prefixCls}-alert-content .${prefixCls}-alert-message {
				color: ${token.magicColorUsages.danger.default};
			}
			& .${prefixCls}-alert-icon {
				color: ${token.magicColorUsages.danger.default};
			}
		}
		&.${prefixCls}-alert-warning {
			background-color: ${token.magicColorUsages.warningLight.default};
		}
		&.${prefixCls}-alert-info {
			background-color: ${token.magicColorUsages.fill[0]};

			& .${prefixCls}-alert-content .${prefixCls}-alert-message {
				color: ${token.magicColorUsages.text[1]};
			}
			& .${prefixCls}-alert-icon {
				color: ${token.magicColorUsages.text[1]};
			}
		}
	`,
}))
