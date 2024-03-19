import { createStyles } from "antd-style"

// 列表相关样式 - 用于 SiderDashboard 主组件
export const useListStyles = createStyles(({ token }) => {
	return {
		headerSection: {
			display: "flex",
			justifyContent: "flex-end",
			alignItems: "center",
			padding: "8px 6px",
			borderBottom: `1px solid ${token.colorBorder}`,
			flexShrink: 0,
		},
		siderDashboard: {
			display: "flex",
			flexDirection: "column",
			flex: 1,
		},
		searchInputWrapper: {
			padding: "0px 6px 4px 6px",
			flex: "none",
		},
		siderDashboardEmpty: {
			flex: "auto",
			overflow: "hidden",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			color: token.colorTextQuaternary,
		},
		siderDashboardContainer: {
			padding: "0px 6px 6px 6px",
			flex: "auto",
			overflowX: "hidden",
			overflowY: "auto",
		},
		siderDashboardContent: {
			display: "flex",
			flexDirection: "column",
			gap: 4,
		},
		titleRight: {
			display: "flex",
			alignItems: "center",
			gap: 8,
		},
		titleRightButton: {
			borderRadius: 4,
		},
		titleRightIcon: {
			stroke: token.colorTextDescription,
		},
		menuDeleteIcon: {
			stroke: token.magicColorUsages.danger.default,
		},
	}
})

// 单个项目相关样式 - 用于 SiderDashboardItem 组件
export const useItemStyles = createStyles(({ cx, css, token }) => {
	const moreActionButton = cx(css`
		display: none;
		flex: none;
	`)

	return {
		item: css`
			display: flex;
			align-items: center;
			height: 36px;
			gap: 4px;
			border-radius: 8px;
			padding: 8px 8px 8px 4px;
			cursor: pointer;
			&:hover {
				background-color: #2e2f380d;
				.${moreActionButton} {
					display: inline-flex;
				}
			}
		`,
		moreActionButton,
		renameing: css`
			.${moreActionButton} {
				display: none !important;
			}
		`,
		arrowIcon: {
			width: 20,
			stroke: token.colorTextDescription,
			flex: "none",
		},
		fileIcon: {
			flex: "none",
		},
		folderIcon: {
			flex: "none",
			position: "relative",
			top: -1.5,
		},
		name: {
			fontSize: 14,
			fontWeight: 400,
			lineHeight: "20px",
			color: token.magicColorUsages.text[1],
			flex: "auto",
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
		},
		renameInput: css`
			padding: 2px 6px;
			font-size: 14px;
			color: ${token.colorText};
			width: 100%;
			height: 20px;
		`,
	}
})
