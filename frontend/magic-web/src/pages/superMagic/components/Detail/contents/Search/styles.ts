import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token }) => ({
	searchContainer: {
		overflow: "hidden",
		height: "100%",
		minHeight: 0,
		display: "flex",
		flexDirection: "column",
		backgroundColor: token.colorBgContainer,
	},
	resultCount: {
		color: token.colorTextSecondary,
		fontSize: 12,
		lineHeight: "22px",
		paddingTop: 2,
		flexShrink: 0,
		whiteSpace: "nowrap",
	},
	queryArea: {
		display: "flex",
		alignItems: "flex-start",
		gap: 12,
		minHeight: 40,
		padding: "9px 16px 5px",
		flexShrink: 0,
	},
	headerActions: {
		flexShrink: 0,
		minWidth: 0,
		width: "max-content",
		maxWidth: "40%",
		marginLeft: "auto",
	},
	query: {
		"--search-query-line-height": "22px",
		display: "grid",
		gridTemplateColumns: "16px minmax(0, 1fr)",
		alignItems: "start",
		gap: 8,
		flex: 1,
		minWidth: 0,
		paddingTop: 2,
		color: token.colorText,
		fontSize: 14,
		lineHeight: "var(--search-query-line-height)",
		// 详情面板可以独立变窄；完整查询允许折行，不通过字符串裁剪丢失检索条件。
		overflowWrap: "anywhere",
	},
	queryIcon: {
		// 与文本首行共用行高；长查询换行后，图标仍居中于首行，不靠像素偏移对齐。
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		width: 16,
		height: "var(--search-query-line-height)",
		lineHeight: 0,
		color: token.colorTextSecondary,
		"& svg": { display: "block", flexShrink: 0, width: 16, height: 16, margin: 0 },
	},
	queryText: {
		display: "block",
		minWidth: 0,
		font: "inherit",
		lineHeight: "var(--search-query-line-height)",
	},
}))
