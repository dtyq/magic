import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token, prefixCls }) => {
	return {
		container: css`
			.${prefixCls}-modal-body {
				padding: 0px;
			}

			.${prefixCls}-modal-content {
				border-radius: 10px;
				border: 1px solid ${token.magicColorUsages.border};
				box-shadow:
					0px 1px 2px -1px rgba(0, 0, 0, 0.1),
					0px 1px 3px 0px rgba(0, 0, 0, 0.1);
				background-color: #fff;
			}
		`,
		header: css`
			padding: 12px;
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 6px;
			font-size: 16px;
			line-height: 24px;
			font-weight: 600;
			color: ${token.magicColorUsages.text[0]};
			border-bottom: 1px solid ${token.magicColorUsages.border};
		`,
		headerClose: css`
			width: 24px;
			height: 24px;
			display: flex;
			align-items: center;
			justify-content: center;
			cursor: pointer;
			border-radius: 6px;
			color: ${token.magicColorUsages.text[0]};

			svg {
				color: ${token.magicColorUsages.text[0]};
			}

			&:hover {
				background-color: ${token.magicColorUsages.fill[1]};
			}
		`,
		content: css`
			padding: 12px;
			height: 500px;
			display: flex;
			flex-direction: column;
			gap: 8px;
		`,
		contentHeader: css`
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 10px;
		`,
		contentToolbar: css`
			display: flex;
			align-items: center;
			gap: 8px;
		`,
		contentSearchExpanded: css`
			width: 100%;
			display: flex;
			align-items: center;
			gap: 8px;
		`,
		contentSearchToggle: css`
			display: flex;
			align-items: center;
			gap: 6px;
		`,
		contentTitle: css`
			font-size: 14px;
			line-height: 14px;
			font-weight: 500;
			color: ${token.magicColorUsages.text[0]};
		`,
		contentCreateButton: css`
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 36px;
			height: 36px;
			padding: 0;
			border-radius: 6px;
			border: 1px solid ${token.magicColorUsages.border};
			background-color: #fff;
			color: ${token.magicColorUsages.text[0]};
			box-shadow: 0px 1px 2px 0px rgba(0, 0, 0, 0.05);

			svg {
				color: ${token.magicColorUsages.text[0]};
			}
		`,
		contentSearch: css`
			flex: 1;
			min-width: 0;
			.${prefixCls}-input-affix-wrapper {
				padding: 4px 12px;
				border-radius: 8px;
				border: 1px solid ${token.magicColorUsages.border};
				box-shadow: 0px 1px 2px 0px rgba(0, 0, 0, 0.05);
				background-color: #fff;
			}

			.${prefixCls}-input-affix-wrapper .${prefixCls}-input {
				font-size: 14px;
				line-height: 20px;
				color: ${token.magicColorUsages.text[0]};
			}

			.${prefixCls}-input-affix-wrapper .${prefixCls}-input::placeholder {
				color: ${token.magicColorUsages.text[3]};
			}
		`,
		contentSearchIcon: css`
			color: ${token.magicColorUsages.text[3]};
			margin-right: 4px;
		`,
		contentSearchButton: css`
			width: 36px;
			height: 36px;
			padding: 0;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			border-radius: 6px;
			border: 1px solid ${token.magicColorUsages.border};
			background-color: #fff;
			color: ${token.magicColorUsages.text[0]};
			box-shadow: 0px 1px 2px 0px rgba(0, 0, 0, 0.05);

			svg {
				color: ${token.magicColorUsages.text[0]};
			}
		`,
		contentList: css`
			flex: 1;
			padding: 0;
			overflow-y: auto;
			display: flex;
			flex-direction: column;
			gap: 2px;

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
		emptyBlock: css`
			flex: 1;
			display: flex;
			align-items: center;
			justify-content: center;
		`,
		emptyStateContainer: css`
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 24px;
			border: 1px dashed ${token.colorBorder};
			border-radius: 10px;
			background-color: #fff;
			width: 100%;
			height: 320px;
		`,
		emptyStateIcon: css`
			width: 48px;
			height: 48px;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			border-radius: 8px;
			border: 1px solid ${token.colorBorder};
			background-color: #fff;
			box-shadow: 0px 1px 2px 0px rgba(0, 0, 0, 0.05);
			color: ${token.magicColorUsages.text[0]};
		`,
		emptyStateMessage: css`
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: 8px;
			text-align: center;
		`,
		emptySearchTitle: css`
			font-size: 18px;
			line-height: 28px;
			font-weight: 500;
			color: ${token.magicColorUsages.text[0]};
		`,
		emptySearchDescription: css`
			font-size: 14px;
			line-height: 20px;
			font-weight: 400;
			color: ${token.magicColorUsages.text[3]};
			text-align: center;
		`,
		contentItem: css`
			padding: 0px 8px;
			min-height: 32px;
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 8px;
			border-radius: 8px;
			border: 1px solid transparent;
			cursor: pointer;

			&:hover {
				background-color: ${token.magicColorUsages.fill[0]};
			}
		`,
		contentItemSelected: css`
			background-color: ${token.magicColorUsages.fill[0]};
			border: 1px solid ${token.magicColorUsages.border};
		`,
		contentItemName: css`
			flex: 1;
			display: flex;
			align-items: center;
			gap: 8px;
			font-size: 14px;
			line-height: 14px;
			color: ${token.magicColorUsages.text[0]};
			overflow: hidden;
		`,
		contentItemIcon: css`
			width: 16px;
			height: 16px;
			display: flex;
			align-items: center;
			justify-content: center;
			border-radius: 4px;
		`,
		contentItemNameText: css`
			flex: 1;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		`,
		contentItemCheckbox: css`
			pointer-events: none;

			.${prefixCls}-checkbox-inner {
				border-radius: 6px;
			}

			.${prefixCls}-checkbox-checked .${prefixCls}-checkbox-inner {
				background-color: #171717;
				border-color: #171717;
			}
		`,
		contentItemInput: css`
			flex: 1;
			min-width: 0;

			&.${prefixCls}-input {
				padding: 4px 12px;
				border-radius: 8px;
				border: 1px solid ${token.magicColorUsages.border};
				box-shadow: 0px 1px 2px 0px rgba(0, 0, 0, 0.05);
				font-size: 14px;
				line-height: 20px;
				color: ${token.magicColorUsages.text[0]};
			}

			&.${prefixCls}-input::placeholder {
				color: ${token.magicColorUsages.text[3]};
			}
		`,
		contentItemActions: css`
			display: flex;
			align-items: center;
			gap: 6px;
		`,
		contentItemActionButton: css`
			width: 24px;
			height: 24px;
			padding: 0;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			border-radius: 6px;
			border: 1px solid ${token.magicColorUsages.border};
			background-color: #fff;
			color: ${token.magicColorUsages.text[0]};
			box-shadow: 0px 1px 2px 0px rgba(0, 0, 0, 0.05);
		`,
		contentItemActionIconConfirm: css`
			color: #10b981;
		`,
		contentItemActionIconCancel: css`
			color: #ef4444;
		`,
		footer: css`
			padding: 12px;
			display: flex;
			align-items: center;
			justify-content: flex-end;
			gap: 6px;
			font-size: 14px;
			line-height: 20px;
			font-weight: 400;
			border-top: 1px solid ${token.magicColorUsages.border};
		`,
		footerCancelButton: css`
			padding: 8px 16px;
			height: 36px;
			color: ${token.magicColorUsages.text[0]};
			background-color: #fff;
			border: 1px solid ${token.magicColorUsages.border};
			border-radius: 8px;
		`,
		footerConfirmButton: css`
			padding: 8px 16px;
			height: 36px;
			color: #fafafa;
			background-color: #171717;
			border: 1px solid #171717;
			border-radius: 8px;
		`,
	}
})
