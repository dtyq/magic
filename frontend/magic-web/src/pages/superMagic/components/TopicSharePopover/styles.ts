import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css }) => {
	return {
		container: css`
			display: flex;
			flex-direction: column;
			gap: 10px;
		`,

		switchRow: css`
			display: flex;
			flex-direction: row;
			align-items: flex-start;
			gap: 12px;
			align-self: stretch;
		`,

		switchLabel: css`
			display: flex;
			flex-direction: column;
			gap: 8px;
			flex: 1;
		`,

		switchTitle: css`
			font-size: 14px;
			font-weight: 500;
			line-height: 1em;
			color: ${token.colorText};
			padding-top: 3px;
		`,

		switchDescription: css`
			font-size: 14px;
			font-weight: 400;
			line-height: 1.4285714285714286em;
			color: ${token.colorTextSecondary};
		`,

		fieldGroup: css`
			display: flex;
			flex-direction: column;
			gap: 8px;
			align-self: stretch;
		`,

		fieldLabel: css`
			font-size: 14px;
			font-weight: 500;
			line-height: 1em;
			color: ${token.colorText};
		`,

		inputRow: css`
			display: flex;
			flex-direction: row;
			align-items: center;
			gap: 8px;
			align-self: stretch;
		`,

		input: css`
			flex: 1;
			height: 36px;
			font-size: 14px;
		`,

		clickableInput: css`
			cursor: pointer;

			&:hover {
				text-decoration: underline;
			}
		`,

		iconButton: css`
			width: 36px;
			height: 36px;
			flex-shrink: 0;
		`,

		advancedSection: css`
			display: flex;
			flex-direction: column;
			gap: 12px;
			padding: 12px;
			background-color: ${token.colorFillTertiary};
			border-radius: 8px;
			align-self: stretch;
		`,

		advancedHeader: css`
			display: flex;
			flex-direction: row;
			justify-content: space-between;
			align-items: center;
			cursor: pointer;
			user-select: none;

			&:hover {
				opacity: 0.8;
			}
		`,

		advancedTitle: css`
			font-size: 14px;
			font-weight: 500;
			line-height: 1em;
			color: ${token.colorText};
		`,

		advancedContent: css`
			display: flex;
			flex-direction: column;
			gap: 8px;
		`,
	}
})
