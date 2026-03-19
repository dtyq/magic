import { createStyles } from "antd-style"

export const useTaskSummaryStyles = createStyles(({ token, css }) => ({
	// 主容器，高度40px，相对定位用于覆盖进度条
	summary: css`
		position: relative;
		height: 40px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 10px;
		background: #f9f9f9;
		overflow: hidden;
	`,

	// 进度条覆盖层，绝对定位，层级在按钮之下
	progressOverlay: css`
		position: absolute;
		top: 0;
		left: 0;
		height: 100%;
		background: ${token.colorPrimaryBg};
		z-index: 1;
		transition: width 0.3s ease;
	`,

	// 左侧上传速度文本
	speedText: css`
		position: relative;
		z-index: 2;
		font-size: 12px;
		font-weight: 400;
		line-height: 16px;
		color: ${token.colorText};
	`,

	// 右侧按钮容器
	actionButtons: css`
		position: relative;
		z-index: 2;
		display: flex;
		align-items: center;
		gap: 10px;
	`,

	// 单个按钮样式
	actionButton: css`
		height: auto;
		padding: 4px 8px;
		background: ${token.colorFillSecondary};
		border: none;
		border-radius: 8px;
		font-size: 12px;
		font-weight: 400;
		line-height: 16px;
		color: ${token.colorText};

		&:hover {
			background: ${token.colorFillTertiary};
			color: ${token.colorText};
		}

		&:active {
			background: ${token.colorFill};
		}

		&:focus {
			box-shadow: none;
		}
	`,

	englishLayout: css`
		/* 英文布局特定样式，如有需要可在此添加 */
	`,
}))

export default useTaskSummaryStyles
