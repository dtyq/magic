import { createStyles } from "antd-style"

export const useStyles = createStyles(({ prefixCls, css, token }) => {
	return {
		search: css`
			font-size: 16px;
			width: 100%;
			.${prefixCls}-select-selector {
					0px 4px 14px 0px rgba(0, 0, 0, 0.1),
					0px 0px 1px 0px rgba(0, 0, 0, 0.3);
			}
		`,
		button: css`
			width: 100%;
			color: ${token.magicColorUsages.text[2]};
			padding-left: 10px;
			justify-content: flex-start !important;
			overflow: hidden;
			font-size: 14px;
		`,
		desc: css`
			font-size: 14px;
			color: ${token.magicColorUsages.text[3]};
		`,
		divider: css`
			margin: 4px 0px;
		`,
		deleteButton: css`
			width: 22px;
			height: 22px;
			color: ${token.magicColorUsages.danger.default};
			cursor: pointer;
		`,
		ellipsis: css`
			line-clamp: 1;
			overflow: hidden;
			text-overflow: ellipsis;
			-webkit-line-clamp: 1;
			-webkit-box-orient: vertical;
			word-break: break-all;
		`,
		link: css`
			color: ${token.magicColorUsages.primary.default};
			font-weight: 600;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		`,
		optionItem: css`
			overflow: hidden;
		`,
	}
})
