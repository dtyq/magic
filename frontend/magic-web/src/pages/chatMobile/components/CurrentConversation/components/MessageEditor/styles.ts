import { createStyles } from "antd-style"

export const useMessageEditorStyles = createStyles(({ token, css }) => {
	return {
		// 根容器样式：默认有底部安全边距，键盘弹起时为 0
		root: css`
			padding-bottom: ${token.safeAreaInsetBottom};
			background-color: ${token.magicColorScales.white};
		`,

		container: css`
			display: flex;
			flex-direction: column;
			border-top: 1px solid ${token.colorBorder};
			background: ${token.colorBgContainer};
			padding: 8px 0;
		`,

		tabsContainer: css`
			padding: 0px 8px;
			overflow-x: auto;
			scrollbar-width: none;
			&::-webkit-scrollbar {
				display: none;
			}
		`,
		tabActive: css`
			background: ${token.colorPrimary};
			color: ${token.colorWhite};

			&:hover {
				background: ${token.colorPrimaryHover};
			}
		`,

		tabIcon: css`
			font-size: 16px;
			margin-bottom: 2px;
		`,

		tabLabel: css`
			font-size: 12px;
			font-weight: 500;
			white-space: nowrap;
		`,

		inputContainer: css`
			min-height: 44px;
			padding: 0 8px;
		`,
		textInputWrapper: css`
			flex: 1;
			min-height: 36px; /* 最小高度，允许扩展 */
			max-height: 120px; /* 最大高度限制 */
			padding: 8px 12px;
			background-color: ${token.magicColorUsages.fill[0]};
			border-radius: 8px;
			display: none;
			align-items: flex-start; /* 内容从顶部开始对齐 */

			&.visible {
				display: flex;
			}
		`,

		voiceInput: css`
			flex: 1;
			min-height: 36px; /* 最小高度，允许扩展 */
			padding-right: 4px;
			display: none;
			align-items: center; /* 语音输入保持居中 */

			&.visible {
				display: flex;
			}
		`,

		textInput: css`
			width: 100%;
			min-height: 20px; /* 最小高度 */
			max-height: 104px; /* 最大高度，考虑容器的 padding */

			/* 覆盖 MagicRichEditor 内部的 overflow 设置 */
			.ProseMirror {
				overflow-y: auto !important;
				max-height: 88px !important; /* 减去容器 padding */

				/* 自定义滚动条样式 - WebKit 浏览器 */
				&::-webkit-scrollbar {
					width: 4px;
				}

				&::-webkit-scrollbar-track {
					background: transparent;
				}

				&::-webkit-scrollbar-thumb {
					background: rgba(0, 0, 0, 0.2);
					border-radius: 2px;
				}

				&::-webkit-scrollbar-thumb:hover {
					background: rgba(0, 0, 0, 0.3);
				}

				/* Firefox 滚动条样式 */
				scrollbar-width: thin;
				scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
			}
		`,

		footerButtons: css`
			flex-shrink: 0;
			padding-left: 4px;
		`,

		footerButton: css`
			cursor: pointer;
		`,
		voiceButton: css`
			margin-right: 4px;
			flex-shrink: 0;
		`,
		actionButton: css`
			&& {
				color: ${token.colorText};
				font-size: 12px;
				font-style: normal;
				font-weight: 400;
				line-height: 16px; /* 133.333% */
				padding: 4px 8px;
				border-radius: 4px;
				background: ${token.magicColorScales.grey[0]};
				cursor: pointer;
				transition: all 0.2s ease;
				flex-shrink: 0;
			}
		`,
		sendButton: css`
			display: flex;
			height: 28px;
			padding: 0px 6px;
			justify-content: center;
			align-items: center;
			border-radius: 8px;
			border: 0px solid rgba(0, 0, 0, 0);
			background: ${token.magicColorUsages.primary.default};
		`,
		inputFilesContainer: css`
			padding: 0 10px;
			overflow-x: auto;
			scrollbar-width: none;
			&::-webkit-scrollbar {
				display: none;
			}
		`,

		// 当覆盖层显示时，隐藏原始输入框
		containerHidden: css`
			visibility: hidden;
			opacity: 0;
			pointer-events: none;
			position: absolute;
			z-index: -1;
		`,

		// 键盘弹起时的样式：padding-bottom 为 0
		keyboardVisible: css`
			padding-bottom: 0 !important;
		`,
	}
})
