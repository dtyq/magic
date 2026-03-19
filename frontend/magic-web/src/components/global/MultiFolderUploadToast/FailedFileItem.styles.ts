import { createStyles } from "antd-style"

export const useFailedFileItemStyles = createStyles(({ token, css }) => ({
	// 主容器 - 行布局
	fileItem: css`
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
		padding: 10px 14px;
		border-bottom: 1px solid ${token.colorBorder};
		background: ${token.colorBgContainer};
		position: relative;

		&:last-child {
			border-bottom: none;
		}
	`,

	// 左侧区域：文件图标 + 文件信息
	leftSection: css`
		display: flex;
		align-items: center;
		gap: 10px;
		flex: 1;
		min-width: 0; // 允许子元素收缩
	`,

	// 文件图标容器 - 32x32
	iconContainer: css`
		width: 32px;
		height: 32px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		overflow: hidden;
	`,

	// 文件信息容器 - 垂直布局
	fileInfo: css`
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 2px;
		flex: 1;
		min-width: 0; // 允许子元素收缩
	`,

	// 文件名 - 14px
	fileName: css`
		font-size: 14px;
		font-weight: 400;
		line-height: 20px;
		color: ${token.magicColorUsages.text[0]};
		margin: 0;
	`,

	// 详细信息行 - 文件大小和失败原因
	detailsRow: css`
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0; // 允许子元素收缩
	`,

	// 文件大小文本
	fileSizeText: css`
		font-size: 12px;
		font-weight: 400;
		line-height: 1.33;
		color: ${token.magicColorUsages.text[2]};
		flex-shrink: 0;
	`,

	// 分隔符
	separator: css`
		font-size: 12px;
		color: ${token.magicColorUsages.text[2]};
		flex-shrink: 0;
	`,

	// 失败原因文本
	errorText: css`
		font-size: 12px;
		font-weight: 400;
		line-height: 1.33;
		color: ${token.magicColorUsages.danger.default};
		flex: 1;
		min-width: 0; // 允许省略号生效
	`,

	// 右侧区域
	rightSection: css`
		display: flex;
		align-items: center;
		flex-shrink: 0;
	`,

	// 重试按钮
	retryButton: css`
		height: 28px;
		padding: 4px 12px;
		font-size: 13px;
	`,

	// 英文布局调整
	englishLayout: css`
		/* 英文环境下的特定样式调整 */
	`,
}))
