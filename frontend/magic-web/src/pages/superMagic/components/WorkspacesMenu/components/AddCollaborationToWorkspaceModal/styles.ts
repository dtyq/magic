import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token, prefixCls }) => {
	return {
		container: css`
			.${prefixCls}-modal-body {
				padding: 0px;
			}
		`,
		header: css`
			padding: 20px;
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 10px;
			font-size: 16px;
			line-height: 22px;
			font-weight: 600;
			color: ${token.magicColorUsages.text[1]};
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
			height: 400px;
			margin: 0 10px;
			display: flex;
			flex-direction: column;
			border-radius: 12px;
			border: 1px solid ${token.magicColorUsages.border};
			overflow: hidden;
		`,
		contentSearch: css`
			width: 100%;
			padding: 10px;
			background-color: ${token.magicColorUsages.fill[0]};
			border-bottom: 1px solid ${token.magicColorUsages.border};
		`,
		contentSearchIcon: css`
			color: ${token.magicColorUsages.text[3]};
			margin-right: 4px;
		`,
		contentList: css`
			flex: 1;
			padding: 10px;
			overflow-y: auto;
			display: flex;
			flex-direction: column;
			gap: 4px;

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
			cursor: pointer;

			&:hover {
				background-color: ${token.magicColorUsages.fill[0]};
			}
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
			padding: 20px;
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 20px;
			font-size: 14px;
			line-height: 20px;
			font-weight: 400;
		`,
		footerCreateButton: css`
			padding: 6px 24px;
			background: #fff;
			border-radius: 8px;
			border: 1px solid ${token.magicColorUsages.border};
			color: ${token.magicColorUsages.text[2]};
		`,
		footerCancelButton: css`
			padding: 6px 12px;
			color: ${token.magicColorUsages.text[1]};
			border: none;
			border-radius: 8px;
		`,
		footerConfirmButton: css`
			padding: 6px 24px;
			color: #fff;
			background-color: ${token.magicColorUsages.primary.default};
			border: none;
			border-radius: 8px;
		`,
	}
})
