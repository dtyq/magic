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
		saveAsContainer: css`
			justify-content: flex-start;
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
		headerAction: css`
			width: 30px;
			height: 30px;
			display: flex;
			align-items: center;
			justify-content: center;
			cursor: pointer;
			border-radius: 6px;
			color: ${token.magicColorUsages.primary.default};

			&:hover {
				background-color: ${token.magicColorUsages.fill[1]};
			}

			&[data-disabled="true"] {
				cursor: not-allowed;
				color: ${token.magicColorUsages.text[3]};
			}
		`,
		content: css`
			flex: 1;
			padding: 10px 14px 12px;
			display: flex;
			flex-direction: column;
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
		saveAsContent: css`
			flex: 1;
			padding: 12px 14px 16px;
			display: flex;
			flex-direction: column;
			gap: 12px;
			overflow-y: auto;
		`,
		sectionLabel: css`
			font-size: 14px;
			line-height: 20px;
			color: ${token.magicColorUsages.text[2]};
		`,
		formCard: css`
			border-radius: 12px;
			background-color: ${token.magicColorUsages.bg[1]};
			border: 1px solid ${token.magicColorUsages.border};
			overflow: hidden;
		`,
		nameInput: css`
			height: 48px;
			border: none;
			border-radius: 0;
			padding: 0 14px;
			background-color: transparent;
			font-size: 16px;
			line-height: 22px;
			color: ${token.magicColorUsages.text[0]};

			&:focus,
			&:focus-within,
			&:hover {
				border: none;
				box-shadow: none;
			}

			input {
				font-size: 16px;
				line-height: 22px;
			}
		`,
		selectRow: css`
			width: 100%;
			height: 48px;
			padding: 0 14px;
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 10px;
			border: none;
			background: transparent;
			color: ${token.magicColorUsages.text[0]};
		`,
		selectRowValue: css`
			flex: 1;
			text-align: left;
			font-size: 16px;
			line-height: 22px;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		`,
		selectChevron: css`
			color: ${token.magicColorUsages.text[2]};
			flex-shrink: 0;
		`,
		cardDivider: css`
			height: 1px;
			background-color: ${token.magicColorUsages.border};
		`,
		/**
		 * 工作区列表外层：与原型 ChatMoreSheet 的 content 区一致（水平 14px），
		 * 让白卡片与弹层边缘留出呼吸间距。
		 */
		workspaceListOuter: css`
			width: 100%;
			flex-shrink: 0;
		`,
		/**
		 * 单块圆角卡片承载整列工作区，对应原型 MenuGroup（bg-card + rounded-lg + overflow-hidden）。
		 * bg-muted 底色下无需 border，圆角对齐 rounded-lg（8px）。
		 */
		workspaceListCard: css`
			width: 100%;
			border-radius: 8px;
			overflow: hidden;
			background-color: ${token.magicColorUsages.bg[1]};
		`,
		/**
		 * 单行工作区：48px 触控高度、左右 14px 内边距，与原型 h-12 + px-[14px] 对齐。
		 */
		workspaceRow: css`
			width: 100%;
			min-height: 48px;
			padding: 0 14px;
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 10px;
			border: none;
			background: transparent;
			cursor: pointer;
			text-align: left;
			color: ${token.magicColorUsages.text[0]};

			&:active {
				opacity: 0.65;
			}
		`,
		workspaceRowLabel: css`
			flex: 1;
			min-width: 0;
			font-size: 16px;
			line-height: 20px;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		`,
		workspaceRowDivider: css`
			height: 1px;
			width: 100%;
			background-color: ${token.magicColorUsages.border};
		`,
		workspaceRowCheck: css`
			flex-shrink: 0;
			color: ${token.magicColorUsages.text[0]};
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
		emptyState: css`
			flex: 1;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 8px;
			padding: 40px 0;
		`,
	}
})
