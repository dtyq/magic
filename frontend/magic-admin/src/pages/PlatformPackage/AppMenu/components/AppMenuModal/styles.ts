import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, prefixCls, token }) => {
	return {
		form: css`
			gap: 10px;

			.${prefixCls}-form-item {
				margin-bottom: 0;
			}

			.${prefixCls}-form-item-label {
				min-width: 180px;
				text-align: start;
			}

			.${prefixCls}-form-item-control {
				display: flex;
				flex-direction: column;
				gap: 6px;
			}
		`,
		iconSelectBtn: css`
			width: fit-content;
			height: 32px;
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 4px;
			padding: 3px;
			border: 1px solid ${token.magicColorUsages.border};
			border-radius: 6px;
			font-size: 12px;
			overflow: hidden;
			cursor: pointer;

			&:hover {
				border-color: ${token.magicColorUsages.primary.default};
			}
		`,
	}
})
