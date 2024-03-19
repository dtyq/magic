import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token, prefixCls }) => {
	return {
		item: css`
			cursor: pointer;
		`,
		selectedModelItem: css`
			border: 1px solid ${token.magicColorUsages.primary.default};
			background-color: ${token.magicColorUsages.primaryLight.default};
			color: ${token.magicColorUsages.primary.default};
		`,
		modal: css`
			.${prefixCls}-modal-close {
				top: 24px;
			}
			.${prefixCls}-modal-body {
				height: 60vh;
				display: flex;
				flex-direction: column;
				gap: 10px;
			}
		`,
		modalTitle: css`
			font-size: 16px;
			font-weight: 600;
			color: ${token.magicColorUsages.text[1]};
		`,
		modalDesc: css`
			font-size: 12px;
			color: ${token.magicColorUsages.text[3]};
		`,
		list: css`
			overflow-y: auto;
			height: 100%;
			scrollbar-width: none;
		`,
		allOrSelect: css`
			padding: 0 !important;
			min-width: unset !important;
		`,
		empty: css`
			margin: auto;
		`,
	}
})
