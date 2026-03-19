import { createStyles } from "antd-style"

export const useStyles = createStyles(
	({ token, responsive }, { isAllFileType }: { isAllFileType?: boolean }) => ({
		fileTreeContainer: {
			height: "100%",
			display: "flex",
			flexDirection: "column",
		},

		content: {
			flex: 1,
			display: "flex",
			flexDirection: "column",
			overflow: "hidden", // 防止内容溢出
		},

		// 表格容器 - 支持横向滚动
		tableContainer: {
			flex: 1,
			overflowX: "auto", // 横向滚动
			overflowY: "auto", // 纵向滚动
			minWidth: 0,
		},

		// 表格包装器 - 撑满容器宽度
		tableWrapper: {
			minWidth: "fit-content", // 最小宽度确保内容不被压缩
			width: "100%", // 撑满容器宽度
		},

		tableHeader: {
			display: "flex",
			backgroundColor: token.magicColorScales.grey[0],
			borderBottom: `1px solid ${token.colorBorder}`,
			minWidth: "fit-content", // 最小宽度保证内容显示
			width: "100%", // 撑满父容器
			position: "sticky",
			top: 0,
			zIndex: 0,
			height: 48,
		},

		treeContent: {
			flex: 1,
			minWidth: "fit-content", // 最小宽度保证内容显示
			width: "100%", // 撑满父容器
		},

		tableRow: {
			display: "flex",
			height: 40,
			borderBottom: `1px solid ${token.colorBorder}`,
			minWidth: "fit-content", // 最小宽度保证内容显示
			width: "100%", // 撑满父容器

			"&:hover": {
				backgroundColor: token.colorFillTertiary,
			},
		},

		// 可点击的行样式（用于文件夹）
		clickableRow: {
			cursor: "pointer",

			"&:hover": {
				backgroundColor: token.colorFillSecondary,
			},

			"&:active": {
				backgroundColor: token.colorFillTertiary,
			},
		},

		// 表头单元格
		headerCell: {
			flex: 1, // 弹性伸缩，填充剩余空间
			minWidth: 200, // 最小宽度确保内容可见
			paddingLeft: 16,
			// borderRight: `1px solid ${token.colorBorder}`,
			fontSize: 14,
			color: token.colorText,
			display: "flex",
			alignItems: "center",

			[responsive.mobile]: {
				minWidth: 150,
				padding: "8px 6px",
			},
		},

		headerTimeCell: {
			minWidth: 200,
			flexShrink: 0, // 防止被压缩
			// borderRight: `1px solid ${token.colorBorder}`,
			color: token.colorText,
			display: "flex",
			alignItems: "center",

			[responsive.mobile]: {
				width: 160,
				minWidth: 160,
				maxWidth: 160,
				padding: "8px 6px",
			},
		},

		headerSizeCell: {
			width: 100, // 固定宽度
			minWidth: 100,
			maxWidth: 100,
			flexShrink: 0, // 防止被压缩
			color: token.colorText,
			display: "flex",
			alignItems: "center",

			[responsive.mobile]: {
				minWidth: 80,
				padding: "8px 6px",
			},
		},

		headerTitle: {
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
		},

		cell: {
			display: "flex",
			alignItems: "center",
			fontSize: 14,
			lineHeight: "20px",
		},
		// 数据行单元格
		nameCell: {
			flex: 1, // 弹性伸缩，填充剩余空间
			minWidth: 200, // 与表头保持一致
			// borderRight: `1px solid ${token.colorBorder}`,
			display: "flex",
			alignItems: "center",
			paddingLeft: isAllFileType
				? 0
				: "calc(8px + var(--indent-level, 0) * var(--indent-size, 26px))",

			[responsive.mobile]: {
				minWidth: 150,
				padding: "8px 6px",
				paddingLeft: isAllFileType
					? 0
					: "calc(4px + var(--indent-level, 0) * var(--indent-size, 16px))",
				minHeight: 36,
			},
		},

		timeCell: {
			width: 200, // 与表头保持一致
			minWidth: 200,
			maxWidth: 200,
			flexShrink: 0, // 防止被压缩
			padding: "8px",
			// borderRight: `1px solid ${token.colorBorder}`,
			display: "flex",
			alignItems: "center",
			paddingLeft: 0,

			[responsive.mobile]: {
				minWidth: 160,
				maxWidth: 160,
				width: 160,
				padding: "8px 6px",
				minHeight: 36,
			},
		},

		sizeCell: {
			width: 100, // 与表头保持一致
			minWidth: 100,
			maxWidth: 100,
			flexShrink: 0, // 防止被压缩
			display: "flex",
			alignItems: "center",
			justifyContent: "flex-end",
			paddingLeft: 0,

			[responsive.mobile]: {
				minWidth: 80,
				padding: "8px 6px",
				minHeight: 36,
			},
		},

		cellContent: {
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
			color: token.colorTextSecondary,
			fontSize: token.fontSizeSM,
			width: "100%",
		},

		expandButton: {
			background: "none",
			border: "none",
			cursor: "pointer",
			padding: 0,
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			color: token.colorTextTertiary,
			flexShrink: 0,

			"&:hover": {
				color: token.colorText,
			},
		},

		fileIconWrapper: {
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			flexShrink: 0,
		},

		fileName: {
			fontSize: token.fontSizeSM,
			color: token.colorTextSecondary,
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
			flex: 1,
			minWidth: 0,
			marginLeft: 4,

			[responsive.mobile]: {
				fontSize: token.fontSizeSM,
			},
		},

		emptyState: {
			padding: "32px 16px",
			textAlign: "center",
			color: token.colorTextTertiary,
			fontSize: 14,
		},

		// 小屏幕下的优化样式（移除隐藏时间列的逻辑）
		mobileOptimized: {
			// 移动端不再隐藏任何列，保持完整表格
		},

		// 移动端统计信息栏
		mobileStatsBar: {
			padding: "8px 12px",
			backgroundColor: token.colorFillQuaternary,
			borderTop: `1px solid ${token.colorBorder}`,
			fontSize: token.fontSizeSM,
			color: token.colorTextSecondary,
			flexShrink: 0, // 防止被压缩

			[responsive.mobile]: {
				display: "block",
			},

			// 非移动端隐藏
			[responsive.tablet]: {
				display: "none",
			},
			[responsive.desktop]: {
				display: "none",
			},
		},

		// 文件名容器样式
		fileNameContainer: {
			minWidth: 0,
			width: "100%",
			display: "flex",
			alignItems: "center",
		},

		// 展开按钮占位符
		expandButtonPlaceholder: {
			width: 18,
			height: 18,
			flexShrink: 0,

			[responsive.mobile]: {
				width: 16,
				height: 16,
			},
		},
		allFileTypeExpandButtonPlaceholder: {
			width: 12,
			height: 12,
			[responsive.mobile]: {
				width: 2,
				height: 2,
			},
		},
	}),
)
