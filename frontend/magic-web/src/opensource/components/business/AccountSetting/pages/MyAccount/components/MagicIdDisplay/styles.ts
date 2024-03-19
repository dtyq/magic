import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css }) => {
	return {
		magicIdDetail: css`
			display: flex;
			align-items: center;
			gap: 2px;
			min-width: 0;
			flex: 1;
			border: 1px solid ${token.colorBorder};
			border-radius: 4px;
			padding: 2px 6px;
			width: fit-content;
		`,

		magicIdLabel: css`
			color: ${token.magicColorUsages.text[3]};
			font-size: 12px;
			font-style: normal;
			font-weight: 400;
			line-height: 16px;
			cursor: default;
			user-select: none;
		`,

		magicIdIcon: css`
			display: flex;
			align-items: center;
			justify-content: center;
			width: 16px;
			height: 16px;
			flex-shrink: 0;
			color: ${token.magicColorUsages.text[1]};
		`,

		magicIdText: css`
			color: ${token.magicColorUsages.text[2]};
			font-size: 12px;
			font-style: normal;
			font-weight: 400;
			line-height: 16px;
		`,

		copyButton: css`
			display: flex;
			align-items: center;
			justify-content: center;
			width: 20px;
			height: 20px;
			cursor: pointer;
			flex-shrink: 0;
			border-radius: 4px;
			transition: all 0.2s ease;

			&:hover {
				background: ${token.magicColorUsages.fill[0]};
			}
		`,

		copyIcon: css`
			color: ${token.magicColorUsages.text[2]};
			transition: color 0.2s ease;
		`,
	}
})
