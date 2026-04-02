import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }, { isLeftDesc }: { isLeftDesc: boolean }) => {
	return {
		container: css`
			padding-top: 20px;
			border-top: 1px solid ${token.colorBorder};
			display: flex;
			gap: 20px;
			flex-direction: column;
		`,
		label: css`
			flex-shrink: 0;
			width: ${isLeftDesc ? "36%" : "180px"};
		`,
		labelText: css`
			font-size: 14px;
			font-weight: 400;
			color: ${token.magicColorUsages.text[1]};
		`,
		labelDesc: css`
			font-size: ${isLeftDesc ? "12px" : "14px"};
			color: ${token.magicColorUsages.text[3]};
		`,
		formItem: css`
			width: 100%;
			height: 32px;
			margin-bottom: 0;
		`,
		textareaFormItem: css`
			width: 100%;
			margin-bottom: 0;
			.ant-input {
				min-height: 120px;
			}
		`,
		required: css`
			&::after {
				content: "*";
				margin-left: 4px;
				color: ${token.colorError};
			}
		`,
		testStatus: css`
			font-size: 14px;
			color: ${token.colorSuccess};
		`,
		fillDefaultUrlBtn: css`
			height: auto;
			padding: 0 6px;
			font-size: 12px;
			border-left: none;
		`,
	}
})
