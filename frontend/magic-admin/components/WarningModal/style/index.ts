import { createStyles } from "antd-style"

export const useStyles = createStyles(({ prefixCls, css, isDarkMode, token }) => ({
	modal: css`
		.${prefixCls}-modal-body {
			padding: 24px;
		}
		.${prefixCls}-modal-footer {
			border-top: 0;
			padding: 0 24px 24px 24px;
		}
	`,
	icon: css`
		flex-shrink: 0;
		margin-top: 2px;
	`,
	title: css`
		font-size: 18px;
		font-weight: 600;
		color: ${token.magicColorUsages.text[1]};
	}
	`,
	descContent: css`
		width: 100%;
		font-size: 14px;
		line-height: 20px;
		color: ${token.magicColorUsages.text[1]};
		overflow: hidden;
	`,
	content: css`
		word-break: break-all;
		color: ${token.magicColorScales.orange[5]};
	`,
	fakeInput: css`
		width: 290px;
		height: 30px;
		padding-left: 12px;
		border-radius: 3px;
		color: ${token.magicColorUsages.text[3]};
		background: ${token.magicColorUsages.fill[0]};
	`,
	input: css`
		width: 290px;
		height: 30px;
		border-radius: 3px;
		border: 0;
		background: ${token.magicColorUsages.fill[0]};
		&:hover {
			background: ${token.magicColorUsages.fill[0]};
		}
	`,
	button: css`
		padding: 6px 12px !important;
		border-radius: 8px;
		min-width: unset !important;
		background: ${token.magicColorUsages.fill[0]};
	`,
	dangerButton: css`
		padding: 6px 12px !important;
		border-radius: 8px;
		&.${prefixCls}-btn-color-dangerous {
			color: ${token.magicColorUsages.danger.default};
			background: ${isDarkMode
				? token.magicColorUsages.danger.default
				: token.magicColorUsages.dangerLight.default};
			&:hover {
				background: ${token.magicColorUsages.dangerLight.hover} !important;
				span {
					color: ${token.magicColorUsages.danger.active};
				}
			}
			&:disabled {
				color: ${token.magicColorUsages.danger.default};
				background: ${token.magicColorScales.red[1]};
			}
		}
	`,
	closeButton: css`
		margin-top: -4px;
	`,
	desc: css`
		font-size: 14px;
		color: ${token.magicColorUsages.text[1]};
	`,
}))
