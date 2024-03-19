import { createStyles, keyframes } from "antd-style"

// 创建一个脉冲动画
const pulseAnimation = keyframes`
  0% {
    transform: scale(1);
    opacity: 0.9;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.4;
  }
  100% {
    transform: scale(1);
    opacity: 0;
  }
`

// 创建一个渐变动画
const gradientAnimation = keyframes`
  0% {
    background-position-x: 200%;
  }
  100% {
    background-position-x: 0%;
  }
`

export const useStyles = createStyles(({ token, css }) => {
	return {
		toolContainer: css`
			display: flex;
			flex-direction: column;
			padding: 10px;
			border-radius: 8px;
			border: 1px solid ${token.colorBorderSecondary};
		`,
		toolHeader: css`
			display: flex;
			align-items: center;
			cursor: pointer;
			justify-content: center;
			user-select: none;
		`,
		collapseIcon: css`
			display: flex;
			align-items: center;
			justify-content: center;
			margin-right: 8px;
			font-size: 12px;
			color: ${token.colorTextSecondary};
		`,
		statusIcon: css`
			display: flex;
			align-items: center;
			justify-content: center;
			margin-right: 8px;
			font-size: 16px;
		`,
		runningIcon: css`
			color: ${token.colorWarning};
		`,
		successIcon: css`
			color: ${token.colorSuccess};
		`,
		errorIcon: css`
			color: ${token.colorError};
		`,
		statusDone: css`
			width: 12px;
			height: 12px;
			color: ${token.colorSuccess};
		`,
		statusError: css`
			width: 12px;
			height: 12px;
			color: ${token.colorError};
		`,
		// 添加动态图标的样式
		doingIconContainer: css`
			position: relative;
			width: 14px;
			height: 14px;
			display: flex;
			align-items: center;
			justify-content: center;
			margin-right: 8px;
		`,
		doingIconOuter: css`
			position: absolute;
			width: 14px;
			height: 14px;
			border-radius: 50%;
			background-color: rgba(255, 236, 204, 1);
		`,
		doingIconInner: css`
			position: absolute;
			width: 8px;
			height: 8px;
			border-radius: 50%;
			background-color: rgba(255, 125, 0, 1);
			z-index: 1;
		`,
		doingIconPulse: css`
			position: absolute;
			width: 14px;
			height: 14px;
			border-radius: 50%;
			background-color: rgba(255, 180, 100, 0.8);
			animation: ${pulseAnimation} 1.5s infinite;
			z-index: 0;
		`,
		// 默认图标样式
		defaultIconContainer: css`
			position: relative;
			width: 14px;
			height: 14px;
			display: flex;
			align-items: center;
			justify-content: center;
			margin-right: 8px;
		`,
		defaultIcon: css`
			width: 14px;
			height: 14px;
			border-radius: 50%;
			background-color: rgba(46, 47, 56, 0.05);
		`,
		toolContent: css`
			flex: 1;
			color: ${token.colorText};
			font-size: 14px;
			color: rgba(28, 29, 35, 0.8);
		`,
		toolFooter: css`
			display: flex;
			align-items: center;
			font-size: 13px;
			color: ${token.colorTextTertiary};
			background: linear-gradient(
				88deg,
				${token.magicColorUsages.fill[1]} -3.79%,
				${token.magicColorUsages.fill[0]} 100%
			);
			border-radius: 100px;
			gap: 4px;
			width: max-content;
			max-width: 100%;
			padding-right: 12px;
		`,
		toolFooterLoading: css`
			background-size: 200% 100%;
			animation: ${gradientAnimation} 2s linear infinite;
			background-image: linear-gradient(90deg, #f9f9f9 35%, #e6e7ea 50%, #f9f9f9 65%);
			background-position-x: 63.16%;
			background-position-y: 50%;
		`,
		icon: css`
			display: inline-block;
			width: 20px;
			height: 20px;
			margin: 4px;
		`,
		action: css`
			color: ${token.colorText};
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		`,
		remark: css`
			max-width: 200px;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			font-size: 12px;
			color: ${token.colorTextQuaternary};
		`,
		urlIcon: css`
			width: 12px;
			height: 12px;
			color: ${token.colorPrimary};
		`,

		// New card-based styles
		toolCard: css`
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 8px 12px;
			border-radius: 8px;
			border: 1px solid ${token.colorBorderSecondary};
			background: ${token.colorBgContainer};
			width: max-content;
			max-width: 100%;
			transition: all 0.2s ease;

			&:hover {
				border-color: ${token.colorPrimary};
				box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
			}
		`,

		toolCardLoading: css`
			background-size: 200% 100%;
			animation: ${gradientAnimation} 2s linear infinite;
			background-image: linear-gradient(90deg, #f9f9f9 35%, #e6e7ea 50%, #f9f9f9 65%);
		`,

		toolInfo: css`
			display: flex;
			flex-direction: column;
			gap: 2px;
			flex: 1;
			min-width: 0;
		`,

		// Standard card styles
		standardCard: css`
			border-color: ${token.colorBorder};
		`,

		standardIcon: css`
			width: 20px;
			height: 20px;
			flex-shrink: 0;
		`,

		standardAction: css`
			color: ${token.colorText};
			font-size: 13px;
			font-weight: 500;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		`,

		standardRemark: css`
			color: ${token.colorTextTertiary};
			font-size: 12px;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			max-width: 200px;
		`,

		// Thinking tool styles
		thinkingCard: css`
			border-color: ${token.colorWarning};
			background: linear-gradient(
				135deg,
				${token.colorWarningBg} 0%,
				${token.colorBgContainer} 100%
			);
		`,

		thinkingIcon: css`
			width: 20px;
			height: 20px;
			flex-shrink: 0;
		`,

		thinkingAction: css`
			color: ${token.colorWarning};
			font-size: 13px;
			font-weight: 600;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		`,

		thinkingRemark: css`
			color: ${token.colorTextSecondary};
			font-size: 12px;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			max-width: 200px;
		`,

		// File operation styles
		fileOperationCard: css`
			border-color: ${token.colorSuccess};
			background: linear-gradient(
				135deg,
				${token.colorSuccessBg} 0%,
				${token.colorBgContainer} 100%
			);
		`,

		fileOperationIcon: css`
			width: 20px;
			height: 20px;
			flex-shrink: 0;
		`,

		fileOperationAction: css`
			color: ${token.colorSuccess};
			font-size: 13px;
			font-weight: 600;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		`,

		fileOperationRemark: css`
			color: ${token.colorTextSecondary};
			font-size: 12px;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			max-width: 200px;
		`,

		// Web search styles
		webSearchCard: css`
			border-color: ${token.colorInfo};
			background: linear-gradient(
				135deg,
				${token.colorInfoBg} 0%,
				${token.colorBgContainer} 100%
			);
		`,

		webSearchIcon: css`
			width: 20px;
			height: 20px;
			flex-shrink: 0;
		`,

		webSearchAction: css`
			color: ${token.colorInfo};
			font-size: 13px;
			font-weight: 600;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		`,

		webSearchRemark: css`
			color: ${token.colorTextSecondary};
			font-size: 12px;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			max-width: 200px;
		`,
	}
})
