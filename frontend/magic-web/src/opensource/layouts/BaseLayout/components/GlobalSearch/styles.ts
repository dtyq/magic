import { createStyles } from "antd-style"

export const useSearchStyles = createStyles(({ token, prefixCls, css }) => {
	return {
		button: css`
			border: none;
			width: 32px;
			height: 32px;
			padding: 6px;
		`,
		modalBody: css`
			--${prefixCls}-modal-body-padding: 0;
			overflow: hidden;
		`,
		header: css`
			height: 44px;
			border-bottom: 1px solid ${token.colorBorderSecondary};
		`,
		content: css`
			overflow: hidden;
		`,
		searchIcon: css`
			margin-left: 20px;
			margin-right: 10px;
			color: ${token.magicColorUsages.text[3]};
		`,
		close: css`
			width: 44px;
			height: 44px;
			padding: 10px;
			cursor: pointer;
			border-left: 1px solid ${token.colorBorderSecondary};
		`,
		input: css`
			width: 100%;
			outline: none;
			box-shadow: unset;
			border: unset;
		`,
	}
})
