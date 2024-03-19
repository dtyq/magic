import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => {
	return {
		button: css`
			border: none;
		`,
		testStatus: css`
			font-size: 14px;
			color: ${token.magicColorUsages.success.default};
		`,
		error: css`
			color: ${token.magicColorUsages.danger.default};
		`,
		checkDetail: css`
			color: ${token.magicColorUsages.primary.default};
			cursor: pointer;
		`,
		defaultIcon: css`
			border-radius: 8px;
			background: linear-gradient(135deg, #ffafc8 25%, #e08aff 60%, #9fc3ff 95%);
			width: 100%;
			height: 100%;
			display: inline-flex;
			justify-content: center;
			align-items: center;
		`,
		errorJson: css`
			font-family: "PingFang SC";
			background-color: ${token.magicColorUsages.fill[0]};
			padding: 12px;
			border-radius: 8px;
			margin: 0;
			font-size: 12px;
			color: ${token.magicColorUsages.text[1]};
			text-wrap: wrap;
			max-height: 200px;
			overflow-y: auto;
		`,
	}
})
