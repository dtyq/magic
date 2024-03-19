import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css }) => {
	// CSS 变量定义
	const dragVariables = css`
		/* 拖拽指示器颜色变量 */
		--drag-indicator-bg: ${token.colorBgContainer};
		--drag-indicator-shadow:
			0px 0px 1px 0px rgba(0, 0, 0, 0.3), 0px 4px 14px 0px rgba(0, 0, 0, 0.1);
		--drag-indicator-border-radius: 8px;

		/* 文本颜色变量 */
		--drag-text-primary: ${token.colorText};
		--drag-text-secondary: ${token.colorTextSecondary};

		/* 拖拽错误状态 */
		--drag-error-bg: ${token.colorErrorBg};
		--drag-error-border: ${token.colorErrorBorder};

		/* 文件夹拖拽目标样式变量 */
		--drag-target-border: 1px solid
			var(--usage-primary-light---semi-color-primary-light-active, #a9bff7);
		--drag-target-bg: var(--usage-primary-light---semi-color-primary-light-default, #eef3fd);
		--drag-target-border-radius: 8px;
	`

	return {
		// 拖拽指示器主容器 - 按照 Figma 原型设计
		dragIndicator: css`
			${dragVariables}
			position: fixed;
			z-index: 9999;
			pointer-events: none;
			user-select: none;

			/* Figma 原型：列布局，间距2px，宽度228px */
			display: flex;
			flex-direction: column;
			gap: 2px;
			max-width: 228px;
		`,

		// 小div在上：移动到目标信息
		topIndicator: css`
			/* Figma 原型：水平布局，居中对齐，间距4px，内边距4px 6px */
			display: flex;
			justify-content: center;
			align-items: center;
			gap: 4px;
			padding: 4px 6px;

			/* Figma 原型：圆角8px，白色背景，阴影效果 */
			background: var(--drag-indicator-bg);
			border-radius: var(--drag-indicator-border-radius);
			box-shadow: var(--drag-indicator-shadow);

			/* 宽度自适应内容 */
			width: fit-content;
			align-self: center;
		`,

		// "移动到" 文本
		moveToText: css`
			/* Figma 原型：PingFang SC，字体大小10px */
			font-family:
				"PingFang SC",
				-apple-system,
				BlinkMacSystemFont,
				sans-serif;
			font-weight: 400;
			font-size: 10px;
			line-height: 1.3;
			color: var(--drag-text-primary);

			/* 确保文字不被挤压 */
			white-space: nowrap;
			flex-shrink: 0;
		`,

		// 目标文件夹名称
		targetName: css`
			/* Figma 原型：PingFang SC，字体大小10px，粗体 */
			font-family:
				"PingFang SC",
				-apple-system,
				BlinkMacSystemFont,
				sans-serif;
			font-weight: 600;
			font-size: 10px;
			line-height: 1.3;
			color: var(--drag-text-primary);

			/* 目标名称可以被截断，但要有最小宽度 */
			min-width: 20px;
			max-width: 120px;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		`,

		// 大div在下：文件项信息
		fileItem: css`
			/* Figma 原型：水平布局，左对齐，间距4px，内边距0px 8px */
			display: flex;
			align-items: center;
			gap: 4px;
			padding: 0px 8px;

			/* Figma 原型：圆角8px，白色背景，阴影效果 */
			background: var(--drag-indicator-bg);
			border-radius: var(--drag-indicator-border-radius);
			box-shadow: var(--drag-indicator-shadow);

			/* 固定高度以匹配文件项 */
			height: 32px;
		`,

		// 文件图标容器
		fileIcon: css`
			/* Figma 原型：图标大小14x14 */
			display: flex;
			align-items: center;
			justify-content: center;
			width: 14px;
			height: 14px;
			flex-shrink: 0;
		`,

		// 文件名文本
		fileName: css`
			/* Figma 原型：PingFang SC，字体大小12px */
			font-family:
				"PingFang SC",
				-apple-system,
				BlinkMacSystemFont,
				sans-serif;
			font-weight: 400;
			font-size: 12px;
			line-height: 1.3333;
			color: var(--drag-text-primary);

			/* 自适应宽度，允许文本溢出处理 */
			flex: 1;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		`,

		// 可以放置状态
		canDrop: css`
			/* 保持原有样式 */
		`,

		// 不能放置状态
		cannotDrop: css`
			/* 错误状态：改变背景色和边框 */
			background: var(--drag-error-bg) !important;
			border: 1px solid var(--drag-error-border) !important;
		`,
	}
})
