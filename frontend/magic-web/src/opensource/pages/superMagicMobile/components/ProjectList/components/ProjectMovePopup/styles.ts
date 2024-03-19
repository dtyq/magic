import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => {
	return {
		container: css`
			width: 100%;
			height: 95%;
			display: flex;
			flex-direction: column;
			justify-content: space-between;
		`,
		header: css`
			padding: 10px 16px;
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 10px;
			font-size: 16px;
			line-height: 22px;
			font-weight: 600;
			color: ${token.magicColorUsages.text[1]};
			border-bottom: 1px solid ${token.magicColorUsages.border};
		`,
		headerClose: css`
			width: 30px;
			height: 30px;
			display: flex;
			align-items: center;
			justify-content: center;
			cursor: pointer;
			border-radius: 6px;

			&:hover {
				background-color: ${token.magicColorUsages.fill[1]};
			}
		`,
		content: css`
			flex: 1;
			padding: 10px;
			display: flex;
			flex-direction: column;
			gap: 6px;
			overflow-y: auto;

			&::-webkit-scrollbar {
				width: 4px;
			}
			&::-webkit-scrollbar-thumb {
				background-color: #fff;
				border-radius: 4px;
			}
			&::-webkit-scrollbar-track {
				background-color: transparent;
			}
		`,
		contentItem: css`
			padding: 8px 10px;
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 10px;
			border-radius: 8px;
			border: 1px solid transparent;
		`,
		contentItemSelected: css`
			background-color: ${token.magicColorUsages.primaryLight.default};
			border: 1px solid ${token.magicColorUsages.primary.default};
		`,
		contentItemName: css`
			flex: 1;
			display: flex;
			align-items: center;
			gap: 10px;
			font-size: 14px;
			line-height: 20px;
			color: ${token.magicColorUsages.text[0]};
			overflow: hidden;
		`,
		contentItemIcon: css`
			width: 24px;
			height: 24px;
			display: flex;
			align-items: center;
			justify-content: center;
			border-radius: 4px;
			background-color: ${token.magicColorUsages.fill[0]};
		`,
		contentItemNameText: css`
			flex: 1;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		`,
		contentItemCheck: css`
			color: ${token.magicColorUsages.primary.default};
		`,
		contentItemInput: css`
			min-width: 220px;
		`,
		footer: css`
			padding: 10px;
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 12px;
			font-size: 14px;
			line-height: 20px;
			font-weight: 400;
			border-top: 1px solid ${token.magicColorUsages.border};
		`,
		footerCreateButton: css`
			flex: 2;
			height: 40px;
			display: flex;
			align-items: center;
			gap: 4px;
			background: #fff;
			border-radius: 8px;
			border: none;
			color: ${token.magicColorUsages.text[1]};
			background-color: ${token.magicColorUsages.fill[0]};
		`,
		footerConfirmButton: css`
			flex: 3;
			height: 40px;
			display: flex;
			text-align: center;
			color: #fff;
			background-color: ${token.magicColorUsages.primary.default};
			border: none;
			border-radius: 8px;
		`,
		contentItemInputRequired: css`
			padding-left: 4px;
			color: ${token.magicColorUsages.danger.default};
		`,
	}
})
