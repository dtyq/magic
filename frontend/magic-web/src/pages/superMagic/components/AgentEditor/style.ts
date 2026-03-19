import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css }) => ({
	container: css`
		min-height: 300px;
		display: flex;
		flex-direction: column;
		background: ${token.colorBgContainer};
		border-radius: ${token.borderRadius}px;
		padding-top: 15px;
	`,
	toolbar: css`
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 16px;
		border-bottom: 1px solid ${token.colorBorder};
		background: ${token.colorFillAlter};
	`,
	editorWrapper: css`
		padding: 0px 80px;

		.simple-editor {
			padding: 15px 0 0 0 !important;
		}

		/* SimpleEditor 自动处理内部样式 */
		.simple-editor-wrapper {
			background: transparent;
			/* 移除内部滚动，让滚动事件冒泡到 Modal */
			overflow: visible !important;
			overscroll-behavior: auto !important;
			height: auto !important;
		}
	`,
	previewContainer: css`
		flex: 1;
		padding: 16px;
		background: ${token.colorBgContainer};
		border: 1px solid ${token.colorBorder};
		border-radius: ${token.borderRadius}px;
		margin-left: 16px;
		overflow: auto;
	`,
	splitView: css`
		display: flex;
		height: 100%;
	`,
	title: css`
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: ${token.colorText};
	`,
}))
