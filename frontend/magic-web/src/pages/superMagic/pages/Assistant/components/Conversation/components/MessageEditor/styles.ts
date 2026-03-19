import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css, responsive, prefixCls }) => ({
	container: css`
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		gap: 10px;
	`,
	editor: css`
		flex: 1;
		max-height: 100px;
		overflow-y: auto;
		font-size: 14px;
		line-height: 20px;
		min-height: 42px;

		&.small {
			font-size: 12px;
			line-height: 16px;
		}

		.ProseMirror {
			/* 清除默认样式 */
			outline: none;
			border: none;
			margin: 0;
			background: transparent;
			word-wrap: break-word;
			word-break: break-word;

			/** 字体样式 */
			font-family: inherit;
			font-style: normal;
			font-weight: 400;
			color: inherit;
			min-height: 40px;

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
				margin: 0 2px;
				vertical-align: top;
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
			${responsive.md} {
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
			}
		}
	`,
	editorFooter: css`
		display: flex;
		align-items: flex-start;
		height: 32px;
		justify-content: space-between;
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
			width: 24px;
			height: 24px;
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
			width: 24px;
			height: 24px;
		}
	`,

	sendButtonDisabled: css`
		background: ${token.magicColorUsages.disabled.bg};
		cursor: not-allowed;
	`,
	footerLeft: css`
		overflow-x: auto;
		overflow-y: hidden;
		white-space: nowrap;
		padding-bottom: 12px;
		height: 42px;
		gap: 10px !important;
		transform: translateY(2px);

		.${prefixCls}-btn {
			padding-left: 6px;
			padding-right: 6px;
			font-size: 12px;
			font-weight: 400;
			line-height: 16px;

			.${prefixCls}-btn-icon {
				margin-inline-end: 2px !important;
			}
		}

		&:empty {
			display: block;
		}
	`,
	footerRight: css`
		display: flex;
		align-items: center;
		gap: 6px;
	`,
	quickInstructionButton: css`
		&& {
			color: ${token.colorText};
			font-size: 14px;
			font-weight: 400;
			line-height: 20px;
			padding: 4px 8px;
			border-radius: 8px;
			cursor: pointer;
			transition: all 0.2s ease;
			flex-shrink: 0;
			border: 1px solid ${token.magicColorUsages.border};
		}
	`,
	referMessageSection: css`
		width: 100%;
	`,
	referMessage: css`
		opacity: 0.8;
		color: ${token.magicColorUsages.text[2]};
		font-size: 12px;
		font-weight: 400;
	`,
}))
