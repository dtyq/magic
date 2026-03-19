import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, prefixCls, css }) => {
	return {
		container: css`
			height: 100%;
			display: flex;
			flex-direction: column;
			overflow: hidden;
		`,
		sideNavContainer: css`
			width: 100%;
			height: 60px;
			padding: 10px;
			/* margin-bottom: 10px; */
			display: flex;
			align-items: center;
			justify-content: space-between;
			background: ${token.magicColorUsages.bg[1]};
			border-bottom: 1px solid ${token.magicColorUsages.border};
		`,
		menuOverlay: css`
			.${prefixCls}-dropdown-menu {
				width: 300px !important;
				padding: 0 !important;
			}
			.${prefixCls}-dropdown-menu-item {
				padding: 0px !important;
				margin-bottom: 6px !important;
			}
			.${prefixCls}-dropdown-menu-title-content {
				width: 100% !important;
			}
		`,
		superMagicMenuOverlay: css`
			.${prefixCls}-dropdown-menu {
				width: 180px !important;
				padding: 10px !important;
			}
		`,
		menuListContainerWrapper: css`
			--${prefixCls}-control-item-bg-hover: transparent !important;
		`,
		menuListContainer: css`
			max-height: 275px;
			overflow-y: auto;
			background: #f9f9f9;
			padding: 5px;
			border-radius: 4px;
			margin: 10px 10px 0 10px;

			/* 自定义滚动条样式 */
			&::-webkit-scrollbar {
				width: 4px; /* 滚动条宽度 */
			}

			&::-webkit-scrollbar-track {
				background: transparent; /* 滚动条轨道背景 */
				border-radius: 2px;
			}

			&::-webkit-scrollbar-thumb {
				background: ${token.magicColorUsages.fill[2]}; /* 滑动条颜色 */
				border-radius: 2px;
				border: none; /* 去掉默认边框 */
			}

			&::-webkit-scrollbar-thumb:hover {
				background: ${token.magicColorUsages.fill[1]}; /* 悬停时稍微深一点 */
			}

			/* Firefox 滚动条样式 */
			scrollbar-width: thin;
			scrollbar-color: ${token.magicColorUsages.fill[2]} transparent;
		`,
		menuIcon: css`
			display: flex;
			align-items: center;
			justify-content: center;
			width: 32px;
			height: 32px;
			border-radius: 8px;
			background: ${token.magicColorUsages.white};
			border: 1px solid ${token.magicColorUsages.border};
			cursor: pointer;
			stroke: ${token.magicColorUsages.text[1]};

			&:hover {
				background: ${token.magicColorUsages.fill[0]};
			}
		`,
		menuIconContent: css`
			stroke: ${token.magicColorUsages.text[2]};
		`,

		addWorkspaceItemWrapper: css`
			margin: 10px;
		`,
		menuItem: css`
			height: 32px;
			width: 100%;
			padding: 6px 10px;
			display: flex;
			align-items: center;
			gap: 4px;
			border-radius: 4px;
			cursor: pointer;
			color: ${token.magicColorUsages.text[1]};
			user-select: none;
			font-weight: 400;
			line-height: 20px;

			&:not(:last-child) {
				margin-bottom: 4px;
			}

			&:hover {
				background: ${token.magicColorUsages.fill[0]};
			}

			&:active {
				color: ${token.magicColorUsages.text[1]};
				background-color: ${token.magicColorUsages.fill[1]};
			}
		`,
		navContainer: css`
			padding: 0px 6px;
		`,
		navItem: css`
			padding: 6px;
			display: flex;
			align-items: center;
			gap: 4px;
			border-radius: 8px;
			font-size: 14px;
			line-height: 20px;
			font-weight: 400;
			color: ${token.magicColorUsages.text[1]};
			cursor: pointer;
			flex-shrink: 0;

			&:hover {
				background: ${token.magicColorUsages.fill[0]};
				color: ${token.magicColorUsages.text[1]};
			}
		`,
		workspaceTopicItem: css`
			justify-content: space-between;
			gap: 4px;
			--actions-display: none;

			&:hover {
				--actions-display: flex;
			}
		`,
		workspaceTopicItemContent: css`
			flex: 1;
			display: flex;
			align-items: center;
			gap: 4px;
			min-width: 0; /* 允许 flex 子元素缩小到 0 */
		`,
		workspaceTopicItemName: css`
			flex: 1;
			display: flex;
			align-items: center;
			gap: 6px;
			min-width: 0; /* 允许 flex 子元素缩小到 0 */
			overflow: hidden; /* 隐藏超出内容 */
		`,
		projectModeIcon: css`
			display: flex;
			align-items: center;
			justify-content: center;
			width: 20px;
			height: 20px;
			color: ${token.magicColorUsages.text[2]};
			border-radius: 4px;
			border: 1px solid ${token.magicColorUsages.border};
		`,
		dataAnalysisIcon: css`
			color: #54d055;
			background: #ecf9ec;
			border-color: #d0f3cf;
		`,
		presentationIcon: css`
			color: #ff9e33;
			background: #fff8eb;
			border-color: #ffeccc;
		`,
		reportIcon: css`
			color: #7e57ea;
			background: #f1eefc;
			border-color: #dbd3fa;
		`,
		actionButtons: css`
			display: var(--actions-display);
			align-items: center;
			gap: 4px;
		`,
		menuItemInput: css`
			width: 100%;
			height: 100%;
			border: 1px solid ${token.colorPrimary};
			border-radius: 4px;
			padding: 2px 6px;
			outline: none;
			color: ${token.magicColorUsages.text[1]};
			background: ${token.magicColorUsages.bg[0]};

			&:focus {
				border-color: ${token.colorPrimary};
			}
		`,
		breadCrumbItem: css`
			padding: 4px 8px;
			display: flex;
			align-items: center;
			gap: 4px;
			border-radius: 8px;
			cursor: pointer;

			&:hover {
				background-color: ${token.magicColorUsages.fill[0]};
			}
		`,
		arrowIcon: css`
			display: flex;
			align-items: center;
			justify-content: center;
			color: ${token.magicColorUsages.text[3]};
		`,
		active: css`
			font-weight: 600;
			color: ${token.colorPrimary} !important;
			background-color: ${token.magicColorUsages.primaryLight.default} !important;
		`,
		content: css`
			flex: 1;
			overflow: hidden;
		`,
		logo: css`
			width: 20px;
			height: 20px;
		`,
		userContainer: css`
			width: 100%;
			padding: 10px 0;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 10px;
			border-top: 1px solid ${token.colorBorderSecondary};
			border-bottom: 1px solid ${token.colorBorderSecondary};
		`,
		shareManagementIcon: css`
			flex-shrink: 0;
			padding: 4px 8px;
			display: flex;
			align-items: center;
			justify-content: center;
			border-radius: 8px;
			border: 1px solid ${token.magicColorUsages.border};
			color: ${token.magicColorUsages.text[1]};
			background: ${token.magicColorScales.white[1]};
			cursor: pointer;
			transition: all 0.2s;

			&:hover {
				background: ${token.magicColorUsages.fill[0]};
				color: ${token.magicColorUsages.text[0]};
			}

			&:active {
				background: ${token.magicColorUsages.fill[1]};
			}
		`,
		longMemoryContainer: css`
			height: 32px;
			flex-shrink: 0;
			padding: 0px 8px;
			display: flex;
			align-items: center;
			gap: 4px;
			font-size: 12px;
			line-height: 16px;
			font-weight: 400;
			color: ${token.magicColorUsages.text[1]};
			border-radius: 8px;
			border: 1px solid ${token.magicColorUsages.border};
			cursor: pointer;
		`,
		longMemoryContainerActive: css`
			color: ${token.magicColorUsages.warning.default};
			background: ${token.magicColorUsages.warningLight.default};
			border: none;
		`,
		pointsContainer: css`
			display: flex;
			align-items: stretch;
			gap: 10px;
			padding: 6px 8px;
			color: ${token.magicColorUsages.text[1]};
			font-size: 12px;
			border-radius: 8px;
			border: 1px solid ${token.magicColorUsages.border};

			&:hover {
				background: #f9f9f9;
			}
		`,
		divider: css`
			align-self: center;
			width: 1px;
			height: 20px;
			background: ${token.magicColorUsages.border};
		`,
		points: css`
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 6px;
			cursor: pointer;
		`,
		purchase: css`
			cursor: pointer;
		`,
		separator: css`
			color: ${token.magicColorUsages.text[3]};
			font-size: 14px;
			font-weight: 400;
			line-height: 20px;
		`,
		statusDotContainer: css`
			display: flex;
			align-items: center;
			justify-content: center;
			width: 18px;
			height: 18px;
			flex: none;
		`,
		statusDot: css`
			width: 8px;
			height: 8px;
			border-radius: 50%;
		`,
		success: css`
			background: linear-gradient(135deg, #32c436 0%, #a4e7a2 100%);
		`,
		running: css`
			background: linear-gradient(
				95.14deg,
				#33d6c0 0%,
				#5083fb 25%,
				#336df4 50%,
				#4752e6 75%,
				#8d55ed 100%
			);
		`,
		error: css`
			background: linear-gradient(90deg, #f85032 0%, #e73827 100%);
		`,
		empty: css`
			background: linear-gradient(135deg, #6b6d75 0%, #c6c8cd 100%);
		`,
		topicIcon: css`
			display: flex;
			align-items: center;
			justify-content: center;
			width: 20px;
			height: 20px;
			border-radius: 4px;
			border: 1px solid ${token.magicColorUsages.border};
		`,
		commonTopicIcon: css`
			background: #eef3fd;
			border-color: #d3dffb;
		`,
		actionButton: css`
			display: flex;
			align-items: center;
			justify-content: center;
			width: 20px;
			height: 20px;
			border-radius: 4px;
			cursor: pointer;

			&:hover {
				background: ${token.magicColorUsages.fill[0]};
			}
		`,

		// 新建工作区的弹窗样式
		createWorkspaceModal: css`
			padding: 10px 0;
			display: flex;
			flex-direction: column;
			gap: 20px;
		`,
		createWorkspaceModalHeader: css`
			display: flex;
			align-items: center;
			justify-content: space-between;
		`,
		createWorkspaceModalClose: css`
			display: flex;
			align-items: center;
			justify-content: center;
			width: 30px;
			height: 30px;
			cursor: pointer;
			border-radius: 4px;

			&:hover {
				background: ${token.magicColorUsages.fill[0]};
			}
		`,
		createWorkspaceModalTitle: css`
			font-size: 16px;
			font-weight: 600;
			line-height: 22px;
			color: ${token.magicColorUsages.text[1]};
		`,
		createWorkspaceModalContent: css`
			display: flex;
			flex-direction: column;
			gap: 10px;
		`,
		createWorkspaceModalContentTitle: css`
			font-size: 12px;
			font-weight: 400;
			line-height: 16px;
			color: ${token.magicColorUsages.text[1]};

			span {
				color: ${token.magicColorUsages.danger.default};
			}
		`,
		createWorkspaceModalFooter: css`
			display: flex;
			align-items: center;
			justify-content: flex-end;
			gap: 10px;
		`,
		createWorkspaceModalCancelButton: css`
			min-width: 76px;
			color: ${token.magicColorUsages.text[2]};
			background: none;
			border: 1px solid ${token.magicColorUsages.border};
			border-radius: 8px;

			&:hover {
				color: ${token.magicColorUsages.text[2]} !important;
			}
		`,
		createWorkspaceModalCreateButton: css`
			min-width: 76px;
			border-radius: 8px;
		`,
		skeletonInput: css`
			height: 18px !important;
			width: 100% !important;
			margin-top: 4px !important;

			&:first-child {
				margin-top: 0 !important;
			}

			&:last-child {
				margin-bottom: 0 !important;
			}
		`,
	}
})
