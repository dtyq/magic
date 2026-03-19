import { createStyles, keyframes } from "antd-style"

export const useStyles = createStyles(({ token, css, responsive }) => {
	const bounce = keyframes`
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	`

	return {
		container: css`
			width: 100%;
			height: 100%;
			padding: 10px;
			overflow: hidden;
			position: relative;
			background: ${token.colorBgContainer};
		`,
		containerWithSmallSize: css`
			border-radius: 8px;
			border: 1px solid ${token.magicColorUsages.border};
		`,
		containerFocused: css`
			border-color: ${token.magicColorUsages.primaryLight.active};
		`,
		innerContainer: css`
			width: 100%;
			height: 100%;
			gap: 10px;

			&.small {
				gap: 6px;
			}
		`,

		invalidContainer: css`
			height: 100%;
			min-height: 122px;
		`,

		invalidText: css`
			color: ${token.magicColorUsages.text[2]};
			font-family: ${token.fontFamily};
			font-size: ${token.magicFontUsages.response.text12px};
			font-style: normal;
			font-weight: 400;
			line-height: 16px;
		`,

		editor: css`
			flex: 1;
			max-height: 200px;
			overflow-y: auto;
			font-size: ${token.magicFontUsages.response.text14px};
			line-height: 20px;
			min-height: 50px;

			&.small,
			&.mobile {
				font-size: 13px;
				line-height: 16px;
				max-height: 290px;
				min-height: 100px;

				.ProseMirror {
					min-height: 34px;
				}
			}

			.ProseMirror {
				/* 清除默认样式 */
				outline: none;
				border: none;
				margin: 0;
				background: transparent;
				word-wrap: break-word;
				word-break: break-word;
				height: 100%;

				/** 字体样式 */
				font-family: inherit;
				font-style: normal;
				font-weight: 400;
				color: inherit;
				min-height: 40px;

				doubao-ai-revision-highlighter {
					display: none;
				}

				/* 清除段落默认边距 */

				p {
					margin: 0;
					padding: 0;
					word-break: break-all;
				}

				/* 占位符样式 */

				.is-editor-empty:first-child::before {
					content: attr(data-placeholder);
					float: left;
					pointer-events: none;
					height: 0;
					color: ${token.magicColorUsages.text[3]};
				}

				.magic-mention {
					overflow: hidden;
					color: #171717;
					text-overflow: ellipsis;
					font-size: ${token.magicFontUsages.response.text12px};
					font-style: normal;
					font-weight: 400;
					line-height: 20px;
					border-radius: 4px;
					background: rgba(37, 99, 235, 0.1);
					display: inline;
					padding: 1px 4px;
					vertical-align: top;
					margin: 0 2px;
					cursor: pointer;
				}

				/* 恢复自动补全提醒样式 */

				p[data-suggestion] {
					position: relative;
					overflow: visible;
				}

				p[data-suggestion]::after {
					display: inline-block;
					color: ${token.colorTextQuaternary};
					content: attr(data-suggestion);
					pointer-events: none;
					height: 0;
				}

				/* 移动端隐藏自动补全提示 */

				${responsive.mobile} {
					p[data-suggestion]::after {
						display: none;
					}
				}

				/* 焦点状态 */

				&:focus {
					outline: none;
				}

				/* 选中文本样式 */

				::selection {
					background: ${token.magicColorUsages.primaryLight.default};
					color: ${token.colorText};
				}

				/* Enhanced selection styles for better visibility */

				::-moz-selection {
					background: ${token.magicColorUsages.primaryLight.default};
					color: ${token.colorText};
				}

				/* Ensure proper selection styles for mention components */

				.magic-mention::selection {
					background: ${token.colorPrimaryBorder};
					color: ${token.colorText};
				}
			}
		`,

		toolBar: css`
			display: flex;
			justify-content: space-between;
			align-items: center;
			gap: 6px;
		`,

		toolBarLeft: css`
			display: flex;
			align-items: center;
			gap: 6px;
			min-width: 0;
			overflow: hidden;
		`,

		toolBarRight: css`
			display: flex;
			align-items: center;
			gap: 10px;

			&.small {
				gap: 4px;
			}

			&.mobile {
				gap: 6px;
			}
		`,

		toolBarButton: css`
			width: 32px;
			height: 32px;
			display: flex;
			align-items: center;
			justify-content: center;
			color: ${token.magicColorUsages.text[1]};
			border-radius: 8px;
			border: 1px solid ${token.magicColorUsages.border};
			cursor: pointer;

			&.small {
				width: 26px;
				height: 26px;
			}

			&:hover {
				background: ${token.magicColorUsages.fill[0]};
			}
		`,

		sendButton: css`
			width: 32px;
			height: 32px;
			display: flex;
			align-items: center;
			justify-content: center;
			background: linear-gradient(311.61deg, #3f8fff -5.88%, #ef2fdf 147.61%);
			border-radius: 8px;
			color: #fff;
			cursor: pointer;
			border: none;

			&.small {
				width: 26px;
				height: 26px;
			}
		`,

		sendButtonDisabled: css`
			background: ${token.magicColorUsages.disabled.bg};
			cursor: not-allowed;
		`,

		interruptIcon: css`
			width: 32px;
			height: 32px;
			cursor: pointer;
		`,
		loading: css`
			width: 100%;
			height: 100%;
			display: flex;
			align-items: center;
			justify-content: center;
			border-radius: 8px;
			background-color: rgba(46, 47, 56, 0.09);

			svg {
				width: 60%;
				height: 60%;
				flex: none;
				animation: ${bounce} 1s linear infinite;
			}
		`,
		interruptIconSmall: css`
			width: 26px;
			height: 26px;

			img {
				width: 26px;
				height: 26px;
			}
		`,

		// Small size styles
		smallToolBar: css`
			display: flex;
			justify-content: space-between;
			align-items: center;
			gap: 4px;
		`,

		smallToolBarLeft: css`
			display: flex;
			align-items: center;
			gap: 4px;
		`,

		smallToolBarRight: css`
			display: flex;
			align-items: center;
			gap: 4px;
		`,

		smallToolBarButton: css`
			width: 24px;
			height: 24px;
			display: flex;
			align-items: center;
			justify-content: center;
			color: ${token.magicColorUsages.text[1]};
			border-radius: 6px;
			border: 1px solid ${token.magicColorUsages.border};
			cursor: pointer;
			padding: 4px;

			&:hover {
				background: ${token.magicColorUsages.fill[0]};
			}
		`,

		smallSendButton: css`
			width: 24px;
			height: 24px;
			display: flex;
			align-items: center;
			justify-content: center;
			background: ${token.magicColorUsages.disabled.bg};
			border-radius: 6px;
			color: #fff;
			cursor: not-allowed;
			border: none;
			padding: 4px;

			&:not(:disabled) {
				background: linear-gradient(311.61deg, #3f8fff -5.88%, #ef2fdf 147.61%);
				cursor: pointer;
			}
		`,

		// Mode selector styles
		modeSelector: css`
			display: flex;
			align-items: center;
			gap: 2px;
			background: ${token.colorPrimaryBg};
			border-radius: 6px;
			padding: 4px;
		`,

		modeSelectorButton: css`
			display: flex;
			align-items: center;
			gap: 2px;
			padding: 0 4px;
			height: 16px;
			border-radius: 4px;
			font-size: ${token.magicFontUsages.response.text12px};
			line-height: 16px;
			color: ${token.colorPrimary};
			cursor: pointer;
			white-space: nowrap;

			&:hover {
				background: rgba(49, 92, 236, 0.1);
			}
		`,

		modelSelector: css`
			display: flex;
			align-items: center;
			gap: 2px;
			padding: 4px;
			height: 24px;
			border-radius: 6px;
			font-size: ${token.magicFontUsages.response.text12px};
			line-height: 16px;
			color: ${token.magicColorUsages.text[1]};
			cursor: pointer;
			white-space: nowrap;

			&:hover {
				background: ${token.magicColorUsages.fill[0]};
			}
		`,

		smallIcon: css`
			width: 12px;
			height: 12px;
			flex-shrink: 0;
		`,

		toolIcon: css`
			width: 16px;
			height: 16px;
			flex-shrink: 0;
		`,

		atButton: css`
			display: flex;
			align-items: center;
			justify-content: center;
			flex-shrink: 0;
		`,
	}
})
