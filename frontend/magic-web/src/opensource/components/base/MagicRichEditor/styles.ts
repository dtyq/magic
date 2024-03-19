import { createStyles } from "antd-style"

const useStyles = createStyles(({ css, token }, { isMobile }: { isMobile?: boolean }) => {
	return {
		toolbar: css`
			border-bottom: 1px solid ${token.colorBorderSecondary};
		`,
		content: css`
			outline: none;
			height: auto;
			overflow: hidden;

			/* 修复高度问题 */
			display: flex;
			flex-direction: column;

			/* 确保编辑器内容区域没有外边框且高度正常 */
			.ProseMirror {
				outline: none !important;
				box-shadow: none !important;
				border: none !important;
				flex: 1;
				overflow: hidden;
				height: auto !important;
				min-height: inherit;
				max-height: none;
				caret-color: ${token.colorText}; /* 设置光标颜色 */
			}

			/* 确保段落没有多余的边距 */
			.ProseMirror p {
				margin: 0;
				padding: 0;
				line-height: 1.5em; /* 设置固定行高 */
				min-height: 1em;
				position: relative;

				/* 隐藏分隔符，在 @ 内容后，会导致异常换行问题 */
				.ProseMirror-separator {
					display: inline;
				}
			}

			/* 光标样式，确保不会影响布局 */
			.ProseMirror .ProseMirror-cursor {
				margin: 0;
				padding: 0;
				position: absolute;
				z-index: 1;
			}

			/* 确保编辑器内容区域在获取焦点时也没有外边框 */
			.ProseMirror:focus,
			.ProseMirror:focus-visible {
				outline: none !important;
				box-shadow: none !important;
				border: none !important;
			}

			/* 确保可编辑区域没有外边框 */
			div[contenteditable="true"] {
				outline: none !important;
				box-shadow: none !important;
				border: none !important;
				height: auto;
				max-height: none;
			}

			/* 确保可编辑区域在获取焦点时也没有外边框 */
			div[contenteditable="true"]:focus,
			div[contenteditable="true"]:focus-visible {
				outline: none !important;
				box-shadow: none !important;
				border: none !important;
			}

			/* 恢复占位符样式 */
			.ProseMirror p.is-editor-empty:first-child::before,
			.ProseMirror p.is-empty::before {
				color: ${token.colorTextPlaceholder};
				content: attr(data-placeholder);
				height: 0;
				pointer-events: none;
				position: absolute;
				top: 0;
				left: 0;
				transition: none;
				transform: translateY(0);
				z-index: 0;
				line-height: 1.5em; /* 与段落行高一致 */
				padding: 0;
				margin: 0;
			}

			/* focus状态下占位符样式 */
			.ProseMirror:focus p.is-editor-empty:first-child::before,
			.ProseMirror:focus p.is-empty::before {
				color: ${token.colorTextQuaternary};
				top: 0 !important;
				left: 0 !important;
				transform: translateY(0) !important;
				line-height: 1.5em !important;
			}

			/* 恢复自动补全提醒样式 */
			p[data-suggestion] {
				position: relative;
				overflow: visible;
			}

			p[data-suggestion]::after {
				display: ${isMobile ? "none" : "inline-block"};
				color: ${token.colorTextQuaternary};
				content: attr(data-suggestion);
				pointer-events: none;
				height: 0;
			}

			/* 修复编辑器容器高度 */
			.tiptap {
				height: auto !important;
				min-height: inherit !important;
				overflow: hidden !important;
				display: flex !important;
				flex-direction: column !important;
			}
		`,
		mention: css`
			color: ${token.colorPrimary};
		`,
		emoji: css`
			display: inline-block;
			vertical-align: middle;
			width: 1.2em;
			height: 1.2em;
			transform: translateY(-0.7px);
		`,
		error: css`
			color: ${token.colorError};
			margin-top: 8px;
			font-size: 14px;
		`,
	}
})

export default useStyles
