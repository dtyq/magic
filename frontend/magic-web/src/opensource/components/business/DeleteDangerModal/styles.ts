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
		margin-top: 4px;
	`,
	title: css`
		font-size: 18px;
		font-weight: 600;
		color: ${token.magicColorUsages.text[1]};
	`,
	desc: css`
		font-size: 14px;
		color: ${token.magicColorUsages.text[1]};
	`,
	content: css`
		display: inline;
		padding: 0 5px;
		color: ${token.magicColorScales.orange[5]};
	`,
	fakeInput: css`
		width: 290px;
		height: fit-content;
		padding: 6px 12px;
		border-radius: 4px;
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
		border-radius: 8px;
		min-width: unset;
		background: ${token.magicColorUsages.fill[0]};
	`,
	normalButton: css`
		border-radius: 8px;
		min-width: unset;
	`,
	dangerButton: css`
		color: ${token.magicColorUsages.white};
		background: ${
			isDarkMode
				? token.magicColorUsages.danger.default
				: token.magicColorUsages.danger.default
		};
		&:hover {
			--${prefixCls}-button-default-hover-bg: ${token.magicColorUsages.danger.hover} !important;
			--${prefixCls}-button-default-active-bg: ${token.magicColorUsages.danger.active};
			span {
				color: ${token.magicColorUsages.white};
			}
		}
		&:disabled {
			color: ${token.magicColorUsages.white};
			background: ${token.magicColorScales.red[1]};
		}
	`,
	mobileContainer: css`
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 16px;
	`,
}))
