import { createStyles } from "antd-style"

export const useTaskItemStyles = createStyles(({ token, css }) => ({
	// 主容器 - 根据Figma设计：行布局，间距10px，内边距10px 14px
	taskItem: css`
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

	rightSection: css`
		display: flex;
		align-items: center;
		gap: 10px;
		flex-shrink: 0;
	`,
	fileActions: css`
		display: flex;
		align-items: center;
		gap: 2px;
	`,
	// 长名称只压缩信息区；窄屏将状态和动作作为完整一组换行。
	taskWithActions: css`
		@media (max-width: 640px) {
			flex-wrap: wrap;
			> :first-child {
				flex-basis: 100%;
			}
			> :nth-child(2) {
				margin-inline-start: auto;
			}
		}
	`,
	// 左侧区域：文件夹图标 + 任务信息
	leftSection: css`
		display: flex;
		align-items: center;
		gap: 10px;
		flex: 1;
		min-width: 0;
	`,

	// 文件夹图标容器 - 32x32
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

	// 任务信息容器 - 垂直布局
	taskInfo: css`
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 2px;
		flex: 1;
		min-width: 0;
	`,

	// 任务名称 - 13px，PingFang SC，400，黑色
	taskName: css`
		font-size: 13px;
		font-weight: 400;
		line-height: 20px;
		color: ${token.magicColorUsages.text[0]};
		margin: 0;
		text-wrap: nowrap;
		max-width: 430px;
		overflow: hidden;
		text-overflow: ellipsis;
	`,

	errorTaskName: css`
		max-width: 250px;
	`,

	// 详细信息行 - 进度和上传目标
	detailsRow: css`
		display: flex;
		align-items: center;
		gap: 20px;
		min-width: 0;
		max-width: 100%;
	`,

	// 进度文本
	progressText: css`
		font-size: 12px;
		font-weight: 400;
		line-height: 1.33;
		color: ${token.magicColorUsages.text[2]};
		flex-shrink: 0;
	`,

	currentDirectoryText: css`
		min-width: 0;
		max-width: 220px;
		flex-shrink: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	`,

	// 上传目标链接容器 - 灰色背景，圆角4px，内边距2px 4px
	uploadTarget: css`
		display: flex;
		align-items: center;
		gap: 2px;
		min-width: 0;
		flex-shrink: 1;
		padding: 2px 4px;
		background: ${token.magicColorUsages.fill[0]};
		border-radius: 4px;
		cursor: pointer;
		transition: background-color 0.2s;
		color: ${token.magicColorUsages.text[2]};

		&:hover {
			background: ${token.magicColorUsages.fill[1]};
		}
	`,

	// 上传目标文本
	uploadTargetText: css`
		font-size: 12px;
		font-weight: 400;
		line-height: 1.33;
		color: ${token.magicColorUsages.text[2]};
		min-width: 0;
		max-width: 250px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	`,
	errorTargetText: css`
		max-width: 100px;
	`,

	// 外链图标 - 12x12
	externalIcon: css`
		width: 12px;
		height: 12px;
		flex-shrink: 0;
	`,

	// 右侧状态区域
	statusSection: css`
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: 20px;
		flex-shrink: 0;
	`,

	statusGrid: css`
		/* 图标和文字共用固定列：百分比、完成、目录阶段及重试都保持同一起点。 */
		display: grid;
		grid-template-columns: 18px 5em;
		column-gap: 6px;
		row-gap: 2px;
		align-items: center;
		font-size: 12px;
		line-height: 18px;
		font-weight: 400;
		overflow-wrap: anywhere;
	`,
	statusProgress: css`
		display: flex;
		align-items: center;
		/* 与 24 格图标的外圆直径及线宽对齐，保留 antd 的进度渲染。 */
		svg {
			transform: scale(calc(11 / 12));
			transform-origin: center;
		}
	`,

	// 进度百分比文本
	progressPercentText: css`
		font-size: 12px;
		font-weight: 400;
		line-height: 18px;
		color: ${token.magicColorUsages.text[2]};
	`,

	// 成功状态图标 - 18x18
	successIcon: css`
		width: 18px;
		height: 18px;
		flex-shrink: 0;
	`,

	// 状态文本
	statusText: css`
		font-size: 12px;
		font-weight: 400;
		line-height: 1.33;
		color: ${token.magicColorUsages.text[2]};
	`,

	// 成功状态文本
	successText: css`
		font-size: 12px;
		font-weight: 400;
		line-height: 18px;
		color: ${token.magicColorUsages.text[2]};
	`,

	// 错误状态文本
	errorText: css`
		font-size: 12px;
		font-weight: 400;
		line-height: 18px;
		color: #ff7d00;
	`,

	// 暂停状态文本
	pausedText: css`
		font-size: 12px;
		font-weight: 400;
		line-height: 1.33;
		color: rgba(255, 125, 0, 0.8);
	`,

	// 重试按钮
	retryButton: css`
		grid-column: 2;
		justify-self: start;
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 5px;
		padding: 4px;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		transition: background-color 0.2s;
		background: transparent;

		&:hover {
			background: ${token.magicColorUsages.warningLight.default};
		}
		&:active {
			background: ${token.magicColorUsages.warningLight.active};
		}
	`,

	// 重试按钮文本
	retryButtonText: css`
		font-size: 12px;
		font-weight: 400;
		line-height: 18px;
		color: #ff7d00;
	`,

	// 警告图标 - 18x18
	warningIcon: css`
		color: ${token.colorWarning};
		width: 18px;
		height: 18px;
		flex-shrink: 0;
	`,

	// 取消按钮
	cancelButton: css`
		padding: 4px;
		border: none;
		background: transparent;
		border-radius: 4px;
		cursor: pointer;
		color: ${token.colorTextTertiary};
		transition: all 0.2s;
		position: absolute;
		top: 8px;
		right: 8px;

		&:hover {
			background: ${token.colorBgTextHover};
			color: ${token.colorError};
		}
	`,

	// 等待状态容器
	pendingContainer: css`
		display: flex;
		align-items: center;
		gap: 20px;
	`,

	// 等待状态文本
	pendingText: css`
		font-size: 12px;
		font-weight: 400;
		line-height: 16px;
		color: ${token.magicColorUsages.text[2]};
	`,

	// 移除任务按钮
	removeTaskButton: css`
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 4px;
		border-radius: 8px;
		font-size: 12px;
		font-weight: 400;
		line-height: 16px;
		color: ${token.magicColorUsages.danger.default};
		cursor: pointer;
		transition: all 0.2s;
		border: none;
		outline: none;
		background: transparent;

		&:hover {
			background: #fff0eb !important;
			color: ${token.magicColorUsages.danger.default}!important;
		}

		&:active {
			background: #fff0eb !important;
			color: ${token.magicColorUsages.danger.default}!important;
		}
	`,

	// 英文布局特定样式
	englishLayout: css`
		/* 英文环境下的特殊样式调整 */
	`,
}))
