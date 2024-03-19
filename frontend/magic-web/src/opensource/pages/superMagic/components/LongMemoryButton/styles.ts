import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css }) => {
	return {
		longMemoryContainer: css`
			height: 34px;
			flex-shrink: 0;
			padding: 0px 8px;
			display: flex;
			align-items: center;
			gap: 4px;
			font-size: 12px;
			line-height: 16px;
			font-weight: 400;
			color: ${token.magicColorUsages.text[1]};
			border-radius: 8px;
			border: 1px solid ${token.magicColorUsages.border};
			cursor: pointer;
		`,
		longMemoryContainerActive: css`
			color: ${token.magicColorUsages.warning.default};
			background: ${token.magicColorUsages.warningLight.default};
			border: none;
		`,
	}
})
