import { createStyles } from "antd-style"

const useStyles = createStyles(({ token, css }) => {
	return {
		container: css`
			width: 100%;
			height: 100%;
			overflow: auto;
		`,
		content: css`
			width: 90%;
			max-width: 980px;
			padding-bottom: 40px;
			margin: 0 auto;
		`,
		messagePanel: css`
			width: 100%;
		`,
		messagePanelTextAreaWrapper: css`
			height: 80px;
		`,

		pojectsWrapper: css``,
		projectsTitle: css`
			display: flex;
			align-items: center;
			justify-content: space-between;
			margin-top: 30px;
			padding: 0 10px;
			margin-bottom: 20px;
		`,
		projectsTitleLeft: css`
			display: flex;
			align-items: center;
			gap: 10px;
			font-weight: 600;
			font-size: 24px;
		`,
		projectsTitleRight: css`
			display: flex;
			align-items: center;
			gap: 4px;
			font-size: 14px;
			color: ${token.magicColorUsages.text[1]};
			line-height: 20px;
			border-radius: 8px;
			cursor: pointer;
		`,
		projectsList: css`
			padding: 0 10px;
			display: grid;
			grid-template-columns: repeat(4, 1fr);
			gap: 10px;
			align-items: stretch; // 确保所有项目高度一致
		`,

		casesWrapper: css``,
		caseTitle: css`
			display: flex;
			align-items: center;
			gap: 10px;
			font-weight: 600;
			font-size: 24px;
			margin-top: 50px;
			padding: 0 10px;
		`,

		caseTypeList: css`
			display: flex;
			gap: 10px;
			margin: 16px 0;
			padding: 0 10px;
		`,
		caseTypeItem: css`
			padding: 4px 8px;
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: 6px;
			font-size: 14px;
			line-height: 20px;
			font-weight: 400;
			color: ${token.magicColorUsages.text[1]};
			cursor: pointer;
			&:hover {
				font-weight: 600;
			}
		`,
		caseTypeItemActive: css`
			color: ${token.magicColorUsages.text[0]};
			font-weight: 600;
		`,
		caseTypeItemActiveLine: css`
			width: 24px;
			height: 4px;
			border-radius: 4px;
			background: ${token.magicColorUsages.primary.default};
		`,
		case: css`
			margin-top: 10px;
			padding: 0 10px;
			width: 100%;
			display: grid;
			grid-template-columns: repeat(3, 1fr);
			gap: 15px;

			// 响应式布局
			@media (max-width: 1200px) {
				grid-template-columns: repeat(2, 1fr);
			}
			@media (max-width: 768px) {
				grid-template-columns: 1fr;
				padding: 0 10px;
			}
		`,
		caseItem: css`
			width: 100%;
			height: 160px;
			display: flex;
			gap: 16px;
			border-radius: 8px;
			padding: 16px 0px 0px 16px;
			overflow: hidden;
			cursor: pointer;
			background-color: white;
			border: 1px solid ${token.magicColorUsages.border};
			position: relative;

			&:hover [data-play-button="true"] {
				opacity: 1;
			}

			&:hover {
				border: 1px solid ${token.magicColorUsages.primaryLight.hover};
				box-shadow:
					0px 0px 1px 0px #0000004d,
					0px 0px 30px 0px #0000000f;
			}

			&:active {
				border: 1px solid ${token.magicColorUsages.primaryLight.active};
				box-shadow: 0px 0px 8px 0px #00000040 inset;
			}
		`,
		caseItemPlay: css`
			position: absolute;
			bottom: 12px;
			right: 24px;
			display: flex;
			align-items: center;
			gap: 4px;
			padding: 4px 12px 4px 4px;
			font-size: 12px;
			font-weight: 400;
			line-height: 16px;
			color: ${token.magicColorUsages.text[1]};
			border-radius: 1000px;
			border: 1px solid ${token.magicColorUsages.border};
			background-color: white;
			z-index: 1;
			opacity: 0;
			transition: opacity 0.15s linear;
		`,
		caseItemContent: css`
			width: 140px;
			flex-shrink: 0;
			display: flex;
			flex-direction: column;
			gap: 8px;
		`,
		caseItemTitle: css`
			font-weight: 600;
			font-size: 14px;
			line-height: 20px;
			color: ${token.magicColorUsages.text[1]};
			display: -webkit-box;
			-webkit-line-clamp: 2;
			-webkit-box-orient: vertical;
			overflow: hidden;
			text-overflow: ellipsis;
		`,
		caseItemSubTitle: css`
			font-size: 12px;
			font-weight: 400;
			line-height: 16px;
			color: ${token.magicColorUsages.text[3]};
			display: -webkit-box;
			-webkit-line-clamp: 5;
			-webkit-box-orient: vertical;
			overflow: hidden;
			text-overflow: ellipsis;
		`,
		caseItemImage: css`
			height: 168px;
			width: auto;
			max-width: none;
			border-radius: 4px;
			box-shadow:
				0px 4px 6px 0px #0000001a,
				0px 0px 1px 0px #0000004d;
			object-fit: cover;
			flex-shrink: 0;
		`,

		// 快捷键按钮样式
		shortcutKeysButton: css`
			width: 36px;
			height: 36px;
			position: fixed;
			bottom: 20px;
			right: 20px;
			background: ${token.magicColorUsages.bg[0]};
			border-radius: 1000px;
			display: flex;
			align-items: center;
			justify-content: center;
			cursor: pointer;
			box-shadow:
				0px 0px 1px 0px #0000004d,
				0px 4px 14px 0px #0000001a;

			&:hover {
				background: #f9f9f9;
			}
		`,

		// 上下文菜单样式
		contextMenu: css`
			min-width: 180px;
			padding: 10px;
			display: flex;
			flex-direction: column;
			gap: 4px;
			background: ${token.magicColorUsages.bg[3]};
			border-radius: 8px;
			border: 1px solid ${token.magicColorUsages.border};
			box-shadow:
				0px 0px 1px 0px #0000004d,
				0px 0px 30px 0px #0000000f;
			user-select: none;
		`,
	}
})

export default useStyles
